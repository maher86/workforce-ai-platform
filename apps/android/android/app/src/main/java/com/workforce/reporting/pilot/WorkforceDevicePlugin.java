package com.workforce.reporting.pilot;

import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.journeyapps.barcodescanner.ScanOptions;
import com.journeyapps.barcodescanner.ScanContract;
import com.google.zxing.client.android.Intents;

@CapacitorPlugin(name = "WorkforceDevice")
public class WorkforceDevicePlugin extends Plugin {
    private boolean trusted() {
        return TrustedOrigin.employee(getBridge().getServerUrl(), getBridge().getWebView().getUrl());
    }
    @PluginMethod public void scanActivation(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted() || !"/employee/connect".equals(Uri.parse(getBridge().getWebView().getUrl()).getPath())) {
                call.reject("Activation scanner unavailable", "APP-ORIGIN"); return;
            }
            ScanOptions options = new ScanOptions();
            options.setDesiredBarcodeFormats(ScanOptions.QR_CODE);
            options.setBeepEnabled(false);
            options.setBarcodeImageEnabled(false);
            options.setOrientationLocked(false);
            options.setPrompt("");
            startActivityForResult(call, new ScanContract().createIntent(getContext(), options), "activationResult");
        });
    }
    @ActivityCallback private void activationResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != android.app.Activity.RESULT_OK || result.getData() == null) {
            call.reject("Scan cancelled", "APP-QR-CANCELLED"); return;
        }
        String url = result.getData().getStringExtra(Intents.Scan.RESULT);
        if (!trusted() || !TrustedOrigin.activation(getBridge().getServerUrl(), url)) {
            call.reject("QR does not belong to this application origin", "APP-QR"); return;
        }
        JSObject response = new JSObject(); response.put("url", url); call.resolve(response);
    }
    @PluginMethod public void openSettings(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (!trusted()) { call.reject("Untrusted origin", "APP-ORIGIN"); return; }
            try {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent); call.resolve();
            } catch (Exception ignored) { call.reject("Settings unavailable", "APP-SETTINGS"); }
        });
    }
    @Override public Boolean shouldOverrideLoad(Uri url) {
        String value = url.toString();
        if ("workforce-reconnect://retry".equals(value)) {
            if (getBridge().getErrorUrl().equals(getBridge().getWebView().getUrl()))
                getBridge().getWebView().loadUrl(getBridge().getServerUrl() + "/employee");
            return true;
        }
        if (TrustedOrigin.same(getBridge().getServerUrl(), value) || value.equals(getBridge().getErrorUrl())) return null;
        // Never inject a native bridge into arbitrary QR/deep-link or external pages.
        return true;
    }
}
