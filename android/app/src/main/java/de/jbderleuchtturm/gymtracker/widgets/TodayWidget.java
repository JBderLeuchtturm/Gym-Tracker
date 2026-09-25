package de.jbderleuchtturm.gymtracker.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONObject;

import de.jbderleuchtturm.gymtracker.R;

/**
 * Heute-Training: welcher Tag, wie weit, was als Naechstes kommt.
 * Ein Tipp oeffnet die Fokus-Ansicht bei der naechsten offenen Uebung.
 */
public class TodayWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        JSONObject snapshot = WidgetData.load(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_today);
        String target = "today";

        views.setTextViewText(R.id.today_label, WidgetData.label(snapshot, "today", "HEUTE"));
        JSONObject days = snapshot != null ? snapshot.optJSONObject("days") : null;
        JSONObject day = days != null ? days.optJSONObject(WidgetData.todayKey()) : null;

        if (day == null) {
            views.setTextViewText(R.id.today_title, "Gym Tracker");
            views.setTextViewText(R.id.today_next, WidgetData.label(snapshot, "openApp", "Einmal die App öffnen"));
            views.setViewVisibility(R.id.today_detail, View.GONE);
            views.setViewVisibility(R.id.today_count, View.GONE);
            views.setViewVisibility(R.id.today_progress, View.GONE);
            views.setViewVisibility(R.id.today_progress_done, View.GONE);
        } else {
            views.setTextViewText(R.id.today_title, day.optString("title", ""));
            boolean rest = day.optBoolean("rest", false);
            int done = day.optInt("done", 0);
            int planned = day.optInt("planned", 0);
            String next = day.optString("next", "");
            String detail = day.optString("detail", "");

            boolean showCount = !rest && planned > 0;
            views.setViewVisibility(R.id.today_count, showCount ? View.VISIBLE : View.GONE);
            views.setTextViewText(R.id.today_count, done + "/" + planned);

            boolean complete = showCount && done >= planned;
            int progress = showCount ? Widgets.percent((double) done / planned) : 0;
            views.setViewVisibility(R.id.today_progress, showCount && !complete ? View.VISIBLE : View.GONE);
            views.setViewVisibility(R.id.today_progress_done, complete ? View.VISIBLE : View.GONE);
            views.setProgressBar(R.id.today_progress, 100, progress, false);
            views.setProgressBar(R.id.today_progress_done, 100, 100, false);

            views.setTextViewText(R.id.today_next, next);
            views.setViewVisibility(R.id.today_next, next.isEmpty() ? View.GONE : View.VISIBLE);
            views.setTextViewText(R.id.today_detail, detail);
            views.setViewVisibility(R.id.today_detail, detail.isEmpty() ? View.GONE : View.VISIBLE);
            target = day.optString("target", "today");
        }

        views.setOnClickPendingIntent(R.id.today_root, Widgets.open(context, target));
        manager.updateAppWidget(ids, views);
    }
}
