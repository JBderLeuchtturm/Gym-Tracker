package de.jbderleuchtturm.gymtracker.widgets;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;

import de.jbderleuchtturm.gymtracker.MainActivity;

/** Gemeinsames der drei Widgets: alle neu zeichnen, und der Weg zurueck in die App. */
public final class Widgets {

    private Widgets() {}

    /** Nach jedem neuen Stand aus der App. */
    public static void updateAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        TodayWidget.render(context, manager, ids(context, manager, TodayWidget.class));
        GoalsWidget.render(context, manager, ids(context, manager, GoalsWidget.class));
        TodosWidget.render(context, manager, ids(context, manager, TodosWidget.class));
    }

    private static int[] ids(Context context, AppWidgetManager manager, Class<?> provider) {
        return manager.getAppWidgetIds(new ComponentName(context, provider));
    }

    /**
     * Tipp aufs Widget: App oeffnen, mit einem Ziel ("focus", "today",
     * "goals", "todos"). Je Ziel ein eigener requestCode, sonst ueberschreibt
     * ein PendingIntent das andere.
     */
    static PendingIntent open(Context context, String target) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction("de.jbderleuchtturm.gymtracker.OPEN_" + target);
        intent.putExtra(MainActivity.EXTRA_TARGET, target);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            context,
            target.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    static int percent(double ratio) {
        return (int) Math.round(Math.max(0, Math.min(1, ratio)) * 100);
    }
}
