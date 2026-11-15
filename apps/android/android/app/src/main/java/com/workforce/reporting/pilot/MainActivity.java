package com.workforce.reporting.pilot;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(WorkforceVoicePlugin.class);
        registerPlugin(WorkforceDevicePlugin.class);
        super.onCreate(state);
    }
}
