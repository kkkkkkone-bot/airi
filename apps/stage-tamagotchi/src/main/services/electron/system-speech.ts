import type { createContext } from '@moeru/eventa/adapters/electron/main'

import process from 'node:process'

import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'

import { defineInvokeHandler } from '@moeru/eventa'

import { electronSystemSpeechSynthesize } from '../../../shared/eventa'

const WINDOWS_SPEECH_SCRIPT = `
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
$text = [Console]::In.ReadToEnd()
if ([string]::IsNullOrWhiteSpace($text)) { throw 'Speech text is empty.' }

Add-Type -AssemblyName System.Speech
$synth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$stream = [System.IO.MemoryStream]::new()
try {
  $language = $env:AIRI_SYSTEM_SPEECH_LANGUAGE
  $voices = @($synth.GetInstalledVoices() | Where-Object { $_.Enabled })
  $voice = $voices | Where-Object { $_.VoiceInfo.Culture.Name -eq $language } | Select-Object -First 1
  if (-not $voice -and $language -like 'zh-*') {
    $voice = $voices | Where-Object { $_.VoiceInfo.Culture.TwoLetterISOLanguageName -eq 'zh' } | Select-Object -First 1
  }
  if ($voice) { $synth.SelectVoice($voice.VoiceInfo.Name) }

  $synth.SetOutputToWaveStream($stream)
  $synth.Speak($text)
  $synth.SetOutputToNull()
  [Console]::Out.WriteLine($synth.Voice.Name)
  [Console]::Out.Write([Convert]::ToBase64String($stream.ToArray()))
}
finally {
  $stream.Dispose()
  $synth.Dispose()
}
`

function encodePowerShellCommand(script: string) {
  return Buffer.from(script, 'utf16le').toString('base64')
}

/** Generates a WAV with the operating system's installed speech voice. */
export function synthesizeWindowsSpeech(text: string, language = 'zh-CN'): Promise<{ data: Uint8Array, voiceName: string }> {
  if (process.platform !== 'win32')
    return Promise.reject(new Error('System speech is currently available on Windows only.'))

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      encodePowerShellCommand(WINDOWS_SPEECH_SCRIPT),
    ], {
      env: {
        ...process.env,
        AIRI_SYSTEM_SPEECH_LANGUAGE: language,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let settled = false
    let timeout: ReturnType<typeof setTimeout>
    const finish = (callback: () => void) => {
      if (settled)
        return
      settled = true
      clearTimeout(timeout)
      callback()
    }
    timeout = setTimeout(() => {
      child.kill()
      finish(() => reject(new Error('System speech generation timed out.')))
    }, 30_000)

    child.stdout.on('data', chunk => stdout.push(Buffer.from(chunk)))
    child.stderr.on('data', chunk => stderr.push(Buffer.from(chunk)))
    child.on('error', error => finish(() => reject(error)))
    child.on('close', (code) => {
      finish(() => {
        if (code !== 0) {
          reject(new Error(Buffer.concat(stderr).toString('utf8').trim() || `System speech exited with code ${code}.`))
          return
        }

        const output = Buffer.concat(stdout).toString('utf8')
        const newline = output.indexOf('\n')
        if (newline < 0) {
          reject(new Error('System speech returned an invalid response.'))
          return
        }

        const voiceName = output.slice(0, newline).trim()
        const encodedAudio = output.slice(newline + 1).trim()
        const audio = Buffer.from(encodedAudio, 'base64')
        if (audio.length < 12 || audio.toString('ascii', 0, 4) !== 'RIFF') {
          reject(new Error('System speech did not return a valid WAV file.'))
          return
        }

        resolve({ data: Uint8Array.from(audio), voiceName })
      })
    })

    child.stdin.end(text, 'utf8')
  })
}

export function createSystemSpeechService(params: {
  context: ReturnType<typeof createContext>['context']
}) {
  defineInvokeHandler(params.context, electronSystemSpeechSynthesize, payload => synthesizeWindowsSpeech(payload.text, payload.language))
}
