param(
  [string]$ProcessName = 'ChatGPT',
  [int]$IntervalMs = 50
)

$ErrorActionPreference = 'Stop'

# This helper only reads Core Audio's per-process peak meter. It never records
# audio or reads the conversation contents.
$source = @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Airi.CodexVoice {
  internal enum EDataFlow { eRender, eCapture, eAll }
  internal enum ERole { eConsole, eMultimedia, eCommunications }

  [ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IMMDeviceEnumerator {
    int EnumAudioEndpoints(EDataFlow dataFlow, int stateMask, out IntPtr devices);
    int GetDefaultAudioEndpoint(EDataFlow dataFlow, ERole role, out IMMDevice device);
    int GetDevice(string id, out IMMDevice device);
    int RegisterEndpointNotificationCallback(IntPtr client);
    int UnregisterEndpointNotificationCallback(IntPtr client);
  }

  [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
  internal class MMDeviceEnumeratorComObject { }

  [ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IMMDevice {
    int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, [MarshalAs(UnmanagedType.IUnknown)] out object instance);
    int OpenPropertyStore(int stgmAccess, out IntPtr properties);
    int GetId([MarshalAs(UnmanagedType.LPWStr)] out string id);
    int GetState(out int state);
  }

  [ComImport, Guid("77AA99A0-1BD6-484F-8BC7-2C654C9A9B6F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioSessionManager2 {
    int GetAudioSessionControl(IntPtr audioSessionGuid, int streamFlags, out IAudioSessionControl sessionControl);
    int GetSimpleAudioVolume(IntPtr audioSessionGuid, int streamFlags, out IntPtr audioVolume);
    int GetSessionEnumerator(out IAudioSessionEnumerator sessionEnumerator);
    int RegisterSessionNotification(IntPtr sessionNotification);
    int UnregisterSessionNotification(IntPtr sessionNotification);
    int RegisterDuckNotification(string sessionIdentifier, IntPtr duckNotification);
    int UnregisterDuckNotification(IntPtr duckNotification);
  }

  [ComImport, Guid("E2F5BB11-0570-40CA-ACDD-3AA01277DEE8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioSessionEnumerator {
    int GetCount(out int sessionCount);
    int GetSession(int sessionCount, out IAudioSessionControl session);
  }

  [ComImport, Guid("F4B1A599-7266-4319-A8CA-E70ACB11E8CD"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioSessionControl {
    int GetState(out int state);
    int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string displayName);
    int SetDisplayName(string displayName, IntPtr eventContext);
    int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string iconPath);
    int SetIconPath(string iconPath, IntPtr eventContext);
    int GetGroupingParam(out Guid groupingId);
    int SetGroupingParam(ref Guid groupingId, IntPtr eventContext);
    int RegisterAudioSessionNotification(IntPtr client);
    int UnregisterAudioSessionNotification(IntPtr client);
  }

  [ComImport, Guid("BFB7FF88-7239-4FC9-8FA2-07C950BE9C6D"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioSessionControl2 : IAudioSessionControl {
    new int GetState(out int state);
    new int GetDisplayName([MarshalAs(UnmanagedType.LPWStr)] out string displayName);
    new int SetDisplayName(string displayName, IntPtr eventContext);
    new int GetIconPath([MarshalAs(UnmanagedType.LPWStr)] out string iconPath);
    new int SetIconPath(string iconPath, IntPtr eventContext);
    new int GetGroupingParam(out Guid groupingId);
    new int SetGroupingParam(ref Guid groupingId, IntPtr eventContext);
    new int RegisterAudioSessionNotification(IntPtr client);
    new int UnregisterAudioSessionNotification(IntPtr client);
    int GetSessionIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string identifier);
    int GetSessionInstanceIdentifier([MarshalAs(UnmanagedType.LPWStr)] out string identifier);
    int GetProcessId(out uint processId);
    int IsSystemSoundsSession();
    int SetDuckingPreference(bool optOut);
  }

  [ComImport, Guid("C02216F6-8C67-4B5B-9D00-D008E73E0064"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IAudioMeterInformation {
    int GetPeakValue(out float peak);
    int GetMeteringChannelCount(out int channelCount);
    int GetChannelsPeakValues(int channelCount, IntPtr peakValues);
    int QueryHardwareSupport(out int hardwareSupportMask);
  }

  public static class OutputMeter {
    private static void Release(object value) {
      if (value != null && Marshal.IsComObject(value)) Marshal.ReleaseComObject(value);
    }

    public static float GetPeak(string processName) {
      IMMDeviceEnumerator enumerator = null;
      IMMDevice device = null;
      IAudioSessionManager2 manager = null;
      IAudioSessionEnumerator sessions = null;
      float result = 0f;

      try {
        enumerator = (IMMDeviceEnumerator)new MMDeviceEnumeratorComObject();
        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(EDataFlow.eRender, ERole.eMultimedia, out device));
        Guid managerId = typeof(IAudioSessionManager2).GUID;
        object managerObject;
        Marshal.ThrowExceptionForHR(device.Activate(ref managerId, 23, IntPtr.Zero, out managerObject));
        manager = (IAudioSessionManager2)managerObject;
        Marshal.ThrowExceptionForHR(manager.GetSessionEnumerator(out sessions));

        int count;
        Marshal.ThrowExceptionForHR(sessions.GetCount(out count));
        for (int index = 0; index < count; index++) {
          IAudioSessionControl control = null;
          try {
            Marshal.ThrowExceptionForHR(sessions.GetSession(index, out control));
            IAudioSessionControl2 control2 = control as IAudioSessionControl2;
            IAudioMeterInformation meter = control as IAudioMeterInformation;
            if (control2 == null || meter == null) continue;

            uint processId;
            if (control2.GetProcessId(out processId) != 0 || processId == 0) continue;
            Process process;
            try { process = Process.GetProcessById((int)processId); }
            catch { continue; }
            using (process) {
              if (!string.Equals(process.ProcessName, processName, StringComparison.OrdinalIgnoreCase)) continue;
            }

            float peak;
            if (meter.GetPeakValue(out peak) == 0 && peak > result) result = peak;
          }
          finally { Release(control); }
        }
      }
      catch { return 0f; }
      finally {
        Release(sessions);
        Release(manager);
        Release(device);
        Release(enumerator);
      }
      return Math.Min(1f, Math.Max(0f, result));
    }
  }
}
'@

Add-Type -TypeDefinition $source -Language CSharp

while ($true) {
  $peak = [Airi.CodexVoice.OutputMeter]::GetPeak($ProcessName)
  [Console]::Out.WriteLine($peak.ToString('0.000', [System.Globalization.CultureInfo]::InvariantCulture))
  Start-Sleep -Milliseconds ([Math]::Max(25, $IntervalMs))
}
