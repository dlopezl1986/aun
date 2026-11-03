import { applyLayoutV2, DASHBOARD_LAYOUT_VERSION, normalizeSettings, type WidgetPreference } from '../userSettings';

const w = (...ids: string[]): WidgetPreference[] => ids.map((id) => ({ id, visible: true }));
const ids = (list: WidgetPreference[]) => list.map((x) => x.id);

describe('dashboard layout v2', () => {
  it('puts all calendars first and Hoy after the quick actions', () => {
    const out = applyLayoutV2(w('dashboard.today', 'dashboard.quickActions', 'calendars.agenda', 'calendars.overview'));
    expect(ids(out)).toEqual(['calendars.overview', 'dashboard.quickActions', 'dashboard.today', 'calendars.agenda']);
  });

  it('leaves the order alone when a widget is missing', () => {
    expect(ids(applyLayoutV2(w('dashboard.today', 'todo.today')))).toEqual(['dashboard.today', 'todo.today']);
  });

  it('migrates stored settings once and then respects the user order', () => {
    const raw = { dashboard: { widgets: w('dashboard.today', 'dashboard.quickActions', 'calendars.overview'), todayHidden: [] } };
    const once = normalizeSettings(raw, []);
    expect(ids(once.dashboard.widgets)).toEqual(['calendars.overview', 'dashboard.quickActions', 'dashboard.today']);
    expect(once.dashboard.layoutVersion).toBe(DASHBOARD_LAYOUT_VERSION);

    const userOrder = {
      ...once,
      dashboard: { ...once.dashboard, widgets: w('dashboard.today', 'calendars.overview', 'dashboard.quickActions') },
    };
    expect(ids(normalizeSettings(userOrder, []).dashboard.widgets)).toEqual([
      'dashboard.today',
      'calendars.overview',
      'dashboard.quickActions',
    ]);
  });
});
