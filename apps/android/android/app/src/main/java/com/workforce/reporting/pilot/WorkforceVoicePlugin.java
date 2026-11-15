package com.workforce.reporting.pilot;

import android.Manifest;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import androidx.lifecycle.Lifecycle;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.File;
import java.io.FileInputStream;

@CapacitorPlugin(name = "WorkforceVoice", permissions = @Permission(alias = "microphone", strings = Manifest.permission.RECORD_AUDIO))
public class WorkforceVoicePlugin extends Plugin {
    private static final long MAX_BYTES = 12 * 1024 * 1024;
    private final Handler main = new Handler(Looper.getMainLooper());
    private MediaRecorder recorder;
    private File clip;
    private String session;
    private String failure;
    private boolean finished;
    private PluginCall permissionCall;
    private boolean permissionPending;
    private final Runnable limit = () -> finish(true);

    @Override public void load() {
        // Crash/kill leftovers are private and never restored as another employee's draft.
        File directory = directory();
        File[] leftovers = directory.listFiles((dir, name) -> name.startsWith("voice-") && name.endsWith(".m4a"));
        if (leftovers != null) for (File file : leftovers) file.delete();
    }
    private File directory() {
        File directory = new File(getContext().getCacheDir(), "workforce-voice");
        if (!directory.isDirectory()) directory.mkdirs();
        return directory;
    }
    private boolean trusted() {
        return TrustedOrigin.employee(getBridge().getServerUrl(), getBridge().getWebView().getUrl());
    }
    private boolean matches(PluginCall call) {
        return session != null && session.equals(call.getString("sessionId"));
    }
    @PluginMethod public void start(PluginCall call) {
        main.post(() -> {
            if (!trusted()) { call.reject("Untrusted recording origin", "APP-ORIGIN"); return; }
            String id = call.getString("sessionId");
            if (id == null || !id.matches("[A-Za-z0-9-]{1,80}") || session != null || permissionPending) {
                call.reject("Recording is busy", "MIC-NATIVE-BUSY"); return;
            }
            session = id;
            if (getPermissionState("microphone") != PermissionState.GRANTED) {
                permissionCall = call;
                permissionPending = true;
                requestPermissionForAlias("microphone", call, "microphoneResult");
            } else begin(call);
        });
    }
    @PermissionCallback private void microphoneResult(PluginCall call) {
        main.post(() -> {
            permissionPending = false;
            permissionCall = null;
            if (call == null) return;
            if (!matches(call)) { call.reject("Recording cancelled", "MIC-NATIVE-CANCELLED"); return; }
            if (!trusted() || getPermissionState("microphone") != PermissionState.GRANTED) {
                clear(); call.reject("Microphone permission denied", "MIC-NATIVE-DENIED"); return;
            }
            begin(call);
        });
    }
    @SuppressWarnings("deprecation") private void begin(PluginCall call) {
        if (!trusted() || !matches(call) || !getActivity().getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.STARTED)) {
            clear(); call.reject("Recording cancelled while app inactive", "MIC-NATIVE-CANCELLED"); return;
        }
        try {
            clip = File.createTempFile("voice-", ".m4a", directory());
            recorder = Build.VERSION.SDK_INT >= 31 ? new MediaRecorder(getContext()) : new MediaRecorder();
            recorder.setAudioSource(MediaRecorder.AudioSource.MIC);
            recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);
            recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);
            recorder.setAudioChannels(1);
            recorder.setAudioSamplingRate(44100);
            recorder.setAudioEncodingBitRate(64000);
            recorder.setMaxDuration(180000);
            recorder.setMaxFileSize(MAX_BYTES);
            recorder.setOutputFile(clip.getAbsolutePath());
            recorder.setOnInfoListener((media, what, extra) -> {
                if (what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_DURATION_REACHED || what == MediaRecorder.MEDIA_RECORDER_INFO_MAX_FILESIZE_REACHED) main.post(() -> finish(true));
            });
            recorder.setOnErrorListener((media, what, extra) -> main.post(() -> {
                failure = "MIC-NATIVE-RECORDER";
                finish(true);
            }));
            recorder.prepare();
            recorder.start();
            finished = false;
            failure = null;
            main.postDelayed(limit, 180000);
            call.resolve();
        } catch (Exception ignored) {
            clear(); call.reject("Could not start native recording", "MIC-NATIVE-RECORDER");
        }
    }
    private void finish(boolean notify) {
        if (session == null || finished || recorder == null) return;
        main.removeCallbacks(limit);
        try { recorder.stop(); } catch (RuntimeException ignored) { failure = "MIC-NATIVE-EMPTY"; }
        recorder.release(); recorder = null; finished = true;
        if (clip == null || clip.length() == 0 || clip.length() > MAX_BYTES) failure = "MIC-NATIVE-EMPTY";
        if (notify) {
            JSObject event = new JSObject(); event.put("sessionId", session);
            notifyListeners("recordingStopped", event, true);
        }
    }
    @PluginMethod public void stop(PluginCall call) {
        main.post(() -> {
            if (!trusted() || !matches(call)) { call.reject("Recording unavailable", "MIC-NATIVE-SESSION"); return; }
            finish(false);
            if (!finished || failure != null || clip == null) {
                String code = failure == null ? "MIC-NATIVE-EMPTY" : failure;
                clear(); call.reject("Recording unavailable", code); return;
            }
            try (FileInputStream input = new FileInputStream(clip)) {
                byte[] bytes = new byte[(int) clip.length()];
                int offset = 0;
                while (offset < bytes.length) {
                    int read = input.read(bytes, offset, bytes.length - offset);
                    if (read < 0) throw new java.io.IOException("Partial recording");
                    offset += read;
                }
                JSObject result = new JSObject(); result.put("mime", "audio/mp4");
                result.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
                clear(); // Delete private native copy before returning; draft now belongs to JS tab memory.
                call.resolve(result);
            } catch (Exception ignored) { clear(); call.reject("Could not read recording", "MIC-NATIVE-FILE"); }
        });
    }
    @PluginMethod public void cancel(PluginCall call) {
        main.post(() -> {
            if (!trusted()) { call.reject("Untrusted origin", "APP-ORIGIN"); return; }
            if (matches(call)) clear();
            call.resolve();
        });
    }
    private void clear() {
        main.removeCallbacks(limit);
        if (recorder != null) {
            try { recorder.stop(); } catch (RuntimeException ignored) {}
            recorder.release(); recorder = null;
        }
        if (clip != null) clip.delete();
        clip = null; session = null; failure = null; finished = false;
        if (permissionCall != null) { permissionCall.reject("Recording cancelled", "MIC-NATIVE-CANCELLED"); permissionCall = null; }
    }
    @Override protected void handleOnPause() { main.post(() -> finish(true)); }
    @Override protected void handleOnDestroy() { main.post(this::clear); }
}
