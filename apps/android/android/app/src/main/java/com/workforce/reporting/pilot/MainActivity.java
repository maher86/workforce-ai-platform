package com.workforce.reporting.pilot;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    private DeviceSigner signer;
    DeviceSigner deviceSigner() throws Exception {
        if (signer == null) throw new IllegalStateException("Device identity unavailable");
        return signer;
    }
    @Override public void onCreate(Bundle state) {
        registerPlugin(WorkforceVoicePlugin.class);
        registerPlugin(WorkforceDevicePlugin.class);
        registerPlugin(WorkforceIdentityPlugin.class);
        super.onCreate(state);
        if (getBridge() == null) return;
        try {
            signer = new DeviceSigner(getBridge().getServerUrl());
            getBridge().getWebView().stopLoading();
            getBridge().setWebViewClient(new SignedWebViewClient(getBridge(), signer));
            getBridge().getWebView().loadUrl(getBridge().getAppUrl());
        } catch (Exception ignored) {
            // Fail closed: no cookie-only fallback for a device-bound employee.
            getBridge().getWebView().loadUrl(getBridge().getErrorUrl());
        }
    }
}
