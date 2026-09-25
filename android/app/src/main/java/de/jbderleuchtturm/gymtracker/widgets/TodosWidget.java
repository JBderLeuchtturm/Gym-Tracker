package de.jbderleuchtturm.gymtracker.widgets;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.graphics.Color;
import android.view.View;
import android.widget.RemoteViews;

import org.json.JSONArray;
import org.json.JSONObject;

import de.jbderleuchtturm.gymtracker.R;

/** To-dos heute: was bis heute faellig und offen ist, Ueberfaelliges zuerst. */
public class TodosWidget extends AppWidgetProvider {

    private static final int[] ROWS = { R.id.todo_row_1, R.id.todo_row_2, R.id.todo_row_3, R.id.todo_row_4, R.id.todo_row_5 };
    private static final int[] DOTS = { R.id.todo_dot_1, R.id.todo_dot_2, R.id.todo_dot_3, R.id.todo_dot_4, R.id.todo_dot_5 };
    private static final int[] TITLES = { R.id.todo_title_1, R.id.todo_title_2, R.id.todo_title_3, R.id.todo_title_4, R.id.todo_title_5 };
    private static final int[] METAS = { R.id.todo_meta_1, R.id.todo_meta_2, R.id.todo_meta_3, R.id.todo_meta_4, R.id.todo_meta_5 };

    @Override
    public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        render(context, manager, ids);
    }

    static void render(Context context, AppWidgetManager manager, int[] ids) {
        if (ids == null || ids.length == 0) return;
        JSONObject snapshot = WidgetData.load(context);
        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_todos);
        views.setTextViewText(R.id.todos_label, WidgetData.label(snapshot, "todos", "TO-DOS HEUTE"));

        JSONObject days = snapshot != null ? snapshot.optJSONObject("todos") : null;
        JSONObject day = days != null ? days.optJSONObject(WidgetData.todayKey()) : null;
        JSONArray items = day != null ? day.optJSONArray("items") : null;
        int shown = items != null ? Math.min(items.length(), ROWS.length) : 0;
        boolean night = WidgetData.isNight(context);

        for (int index = 0; index < ROWS.length; index++) {
            JSONObject item = index < shown ? items.optJSONObject(index) : null;
            if (item == null) {
                views.setViewVisibility(ROWS[index], View.GONE);
                continue;
            }
            views.setViewVisibility(ROWS[index], View.VISIBLE);
            views.setTextViewText(TITLES[index], item.optString("title", ""));
            String meta = item.optString("meta", "");
            views.setTextViewText(METAS[index], meta);
            views.setViewVisibility(METAS[index], meta.isEmpty() ? View.GONE : View.VISIBLE);
            views.setInt(DOTS[index], "setColorFilter", color(item.optString(night ? "color" : "colorLight", ""), night));
        }

        int total = day != null ? day.optInt("count", shown) : 0;
        views.setTextViewText(R.id.todos_count, total > 0 ? String.valueOf(total) : "");
        int more = total - shown;
        views.setViewVisibility(R.id.todos_more, more > 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.todos_more,
            WidgetData.label(snapshot, "more", "+{n} weitere").replace("{n}", String.valueOf(more)));
        views.setViewVisibility(R.id.todos_empty, shown == 0 ? View.VISIBLE : View.GONE);
        views.setTextViewText(R.id.todos_empty, WidgetData.label(snapshot, "noTodos", "Nichts mehr für heute"));

        views.setOnClickPendingIntent(R.id.todos_root, Widgets.open(context, "todos"));
        manager.updateAppWidget(ids, views);
    }

    private static int color(String hex, boolean night) {
        try {
            if (!hex.isEmpty()) return Color.parseColor(hex);
        } catch (IllegalArgumentException ignored) {
            // Unbekannte Farbe - dann eben neutral.
        }
        return night ? 0xFF9A968E : 0xFF5A564E;
    }
}
