package de.jbderleuchtturm.gymtracker.widgets;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Configuration;

import org.json.JSONException;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Der Stand, den die App den Widgets hinterlaesst.
 *
 * Aufbau siehe src/lib/widgetSnapshot.ts. Die App rechnet alles vor - auch
 * die naechsten sieben Tage und die naechste Woche -, damit ein Widget morgens
 * den richtigen Tag zeigt, ohne dass die App dafuer laufen muss. Hier wird nur
 * noch der Eintrag fuer heute herausgesucht.
 */
public final class WidgetData {

    private static final String PREFS = "gym_widgets";
    private static final String KEY = "snapshot";

    private WidgetData() {}

    public static void save(Context context, String json) {
        prefs(context).edit().putString(KEY, json).apply();
    }

    static JSONObject load(Context context) {
        String raw = prefs(context).getString(KEY, null);
        if (raw == null) return null;
        try {
            return new JSONObject(raw);
        } catch (JSONException error) {
            return null;
        }
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Heute als yyyy-mm-dd in Ortszeit - derselbe Schluessel wie todayISO() in der App. */
    static String todayKey() {
        return format(Calendar.getInstance());
    }

    /** Montag dieser Woche als yyyy-mm-dd. */
    static String mondayKey() {
        Calendar calendar = Calendar.getInstance();
        int sinceMonday = (calendar.get(Calendar.DAY_OF_WEEK) - Calendar.MONDAY + 7) % 7;
        calendar.add(Calendar.DAY_OF_MONTH, -sinceMonday);
        return format(calendar);
    }

    private static String format(Calendar calendar) {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(calendar.getTime());
    }

    /** Beschriftung aus dem Stand - dort steht sie schon in der Sprache der App. */
    static String label(JSONObject snapshot, String key, String fallback) {
        if (snapshot == null) return fallback;
        JSONObject labels = snapshot.optJSONObject("labels");
        if (labels == null) return fallback;
        String value = labels.optString(key, "");
        return value.isEmpty() ? fallback : value;
    }

    static boolean isNight(Context context) {
        int mode = context.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK;
        return mode == Configuration.UI_MODE_NIGHT_YES;
    }
}
