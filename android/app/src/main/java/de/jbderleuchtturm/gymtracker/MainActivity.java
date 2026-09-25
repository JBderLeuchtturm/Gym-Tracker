package de.jbderleuchtturm.gymtracker;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

/**
 * Die App: eine WebView mit den eingebauten Dateien der Web-App.
 *
 * Dazu kommt ein eigenes Plugin (GymNative) fuer das, was eine Webseite nicht
 * kann - Widgets fuettern, den Bildschirm wach halten, vibrieren. Tippt man
 * auf ein Widget, kommt die App mit einem Ziel ("focus", "todos" …) hierher.
 */
public class MainActivity extends BridgeActivity {

    public static final String EXTRA_TARGET = "gym_target";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Eigene Plugins muessen vor super.onCreate angemeldet sein.
        registerPlugin(GymNativePlugin.class);
        super.onCreate(savedInstanceState);
    }

    /** Laeuft beim Kaltstart (BridgeActivity ruft es selbst auf) und bei jedem Widget-Tipp. */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (intent == null) return;
        String target = intent.getStringExtra(EXTRA_TARGET);
        if (target == null) return;
        // Nur einmal zustellen - sonst oeffnete ein spaeterer Neustart das Ziel erneut.
        intent.removeExtra(EXTRA_TARGET);
        GymNativePlugin.deliverTarget(target);
    }
}
