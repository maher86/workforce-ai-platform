package com.workforce.reporting.pilot;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "WorkforceIdentity")
public class WorkforceIdentityPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private boolean trusted() { return TrustedOrigin.employee(getBridge().getServerUrl(), getBridge().getWebView().getUrl()); }
    @PluginMethod public void activation(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted() || !"/employee/activate".equals(android.net.Uri.parse(getBridge().getWebView().getUrl()).getPath())) { call.reject("Untrusted activation", "DEVICE-ORIGIN"); return; }
            executor.execute(() -> {
                try { respond(call, ((MainActivity)getActivity()).deviceSigner().activation(call.getString("token"))); }
                catch (Exception ignored) { call.reject("Device key unavailable", "DEVICE-KEY"); }
            });
        });
    }
    @PluginMethod public void authorize(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted()) { call.reject("Untrusted page", "DEVICE-ORIGIN"); return; }
            executor.execute(() -> {
                try { respond(call, ((MainActivity)getActivity()).deviceSigner().headers(call.getString("method", "GET"), call.getString("url", ""))); }
                catch (Exception ignored) { call.reject("Could not prove device", "DEVICE-PROOF"); }
            });
        });
    }
    private void respond(PluginCall call, Map<String, String> values) {
        JSObject result = new JSObject(); for (Map.Entry<String, String> value : values.entrySet()) result.put(value.getKey(), value.getValue());
        call.resolve(result);
    }
    @Override protected void handleOnDestroy() { executor.shutdownNow(); }
}
