package de.jbderleuchtturm.gymtracker.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import de.jbderleuchtturm.gymtracker.R;

/** Wochenziele: bis zu vier Messleisten - Tage, Minuten, Volumen, Muskelgruppen. */
public class GoalsWidget extends AppWidgetProvider {

    private static final int[] ROWS = { R.id.goal_row_1, R.id.goal_row_2, R.id.goal_row_3, R.id.goal_row_4 };
    private static final int[] LABELS = { R.id.goal_label_1, R.id.goal_label_2, R.id.goal_label_3, R.id.goal_label_4 };
    private static final int[] VALUES = { R.id.goal_value_1, R.id.goal_value_2, R.id.goal_value_3, R.id.goal_value_4 };
    private static final int[] BARS = { R.id.goal_bar_1, R.id.goal_bar_2, R.id.goal_bar_3, R.id.goal_bar_4 };
    private static final int[] DONE = { R.id.goal_done_1, R.id.goal_done_2, R.id.goal_done_3, R.id.goal_done_4 };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        JSONObject snapshot = WidgetData.load(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_goals);
        views.setTextViewText(R.id.goals_label, WidgetData.label(snapshot, "goals", "WOCHENZIELE"));

        JSONObject weeks = snapshot != null ? snapshot.optJSONObject("weeks") : null;
        JSONArray meters = weeks != null ? weeks.optJSONArray(WidgetData.mondayKey()) : null;
        int count = meters != null ? Math.min(meters.length(), ROWS.length) : 0;

        for (int index = 0; index < ROWS.length; index++) {
            JSONObject meter = index < count ? meters.optJSONObject(index) : null;
            if (meter == null) {
                views.setViewVisibility(ROWS[index], View.GONE);
                continue;
            }
            boolean done = meter.optBoolean("done", false);
            views.setViewVisibility(ROWS[index], View.VISIBLE);
            views.setTextViewText(LABELS[index], meter.optString("label", ""));
            views.setTextViewText(VALUES[index], meter.optString("text", ""));
            views.setProgressBar(BARS[index], 100, Widgets.percent(meter.optDouble("ratio", 0)), false);
            views.setViewVisibility(BARS[index], done ? View.GONE : View.VISIBLE);
            views.setViewVisibility(DONE[index], done ? View.VISIBLE : View.GONE);
        }

        views.setViewVisibility(R.id.goals_empty, count == 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.goals_empty, WidgetData.label(snapshot, "noGoals", "Wochenziele festlegen"));
        views.setOnClickPendingIntent(R.id.goals_root, Widgets.open(context, "goals"));
        manager.updateAppWidget(ids, views);
    }
}
