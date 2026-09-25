package de.jbderleuchtturm.gymtracker;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.WindowManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import de.jbderleuchtturm.gymtracker.widgets.WidgetData;
import de.jbderleuchtturm.gymtracker.widgets.Widgets;

/**
 * Was die Web-App auf dem Handy zusaetzlich braucht.
 *
 * Gegenstueck: src/native/native.ts. Jede Methode ist klein und tut genau
 * eine Sache; die ganze Logik (was steht im Widget, wann ist ein Update da)
 * bleibt im TypeScript, damit sie im Browser getestet werden kann.
 */
@CapacitorPlugin(name = "GymNative")
public class GymNativePlugin extends Plugin {

    private static GymNativePlugin instance;
    private static String pendingTarget;

    @Override
    public void load() {
        instance = this;
    }

    /**
     * Ein Widget wurde angetippt. Hoert die Seite schon zu, bekommt sie das
     * Ziel sofort; sonst liegt es bereit, bis sie beim Start danach fragt.
     */
    static void deliverTarget(String target) {
        GymNativePlugin plugin = instance;
        if (plugin != null && plugin.hasListeners("launchTarget")) {
            JSObject data = new JSObject();
            data.put("target", target);
            plugin.notifyListeners("launchTarget", data);
        } else {
            pendingTarget = target;
        }
    }

    @PluginMethod
    public void getLaunchTarget(PluginCall call) {
        JSObject result = new JSObject();
        if (pendingTarget != null) result.put("target", pendingTarget);
        pendingTarget = null;
        call.resolve(result);
    }

    /** Neuer Stand fuer die Widgets - als fertiges JSON aus src/lib/widgetSnapshot.ts. */
    @PluginMethod
    public void updateWidgets(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json fehlt");
            return;
        }
        Context context = getContext();
        WidgetData.save(context, json);
        Widgets.updateAll(context);
        call.resolve();
    }

    /** Bildschirm an lassen, solange trainiert wird (die WebView kennt kein wakeLock). */
    @PluginMethod
    public void keepAwake(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) {
                getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
        });
        call.resolve();
    }

    /** Muster wie navigator.vibrate: an, aus, an … in Millisekunden. */
    @PluginMethod
    public void vibrate(PluginCall call) {
        JSArray pattern = call.getArray("pattern");
        if (pattern == null || pattern.length() == 0) {
            call.resolve();
            return;
        }
        long[] timings = new long[pattern.length() + 1];
        timings[0] = 0;
        for (int index = 0; index < pattern.length(); index++) {
            timings[index + 1] = Math.max(0, pattern.optLong(index, 0));
        }

        Vibrator vibrator;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager manager = (VibratorManager) getContext().getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = manager != null ? manager.getDefaultVibrator() : null;
        } else {
            vibrator = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
        }
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(timings, -1));
            } else {
                vibrator.vibrate(timings, -1);
            }
        }
        call.resolve();
    }

    /** Eine Adresse im Browser des Handys oeffnen - etwa die neue APK. */
    @PluginMethod
    public void openExternal(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("url fehlt");
            return;
        }
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (ActivityNotFoundException error) {
            call.reject("Kein Browser gefunden");
        }
    }
}
