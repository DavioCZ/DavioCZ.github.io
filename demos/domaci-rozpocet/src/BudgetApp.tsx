import { useEffect, useMemo, useState } from "react";
import * as R from "recharts";

// ----------------------------------------------
// Mini home budget app (single-file React)
// • localStorage persistence
// • transactions, categories grouped as Příjem/Potřeby/Přání/Úspory
// • monthly overview + pie chart of expenses (Recharts)
// • import/export JSON
// • simple recurring entries with confirmation
// • WITHOUT envelopes / obálky
// ----------------------------------------------

// ===== Utils =====
const fmt = (n: number | string | null | undefined) => {
  if (n == null || isNaN(Number(n))) return "–";
  return Number(n).toLocaleString("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  });
};

const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const dueDateFor = (y: number, m: number, day: number) =>
  new Date(y, m, Math.min(Number(day) || 1, daysInMonth(y, m)));

const parseLocalDate = (value: string | Date) => {
  if (value instanceof Date) return value;

  if (typeof value === "string") {
    const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const [, y, mo, d] = m;
      return new Date(Number(y), Number(mo) - 1, Number(d));
    }
  }

  // fallback – když to není čistý YYYY-MM-DD
  return new Date(value);
};

const todayLocalString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const shiftMonth = (current: string, delta: number) => {
  // očekává "YYYY-MM"
  const [yStr, mStr] = current.split("-");
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1; // 0–11

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return current; // kdyby tam bylo něco divného, radši nic neměnit
  }

  const d = new Date(year, monthIndex + delta, 1);
  return ym(d); // zpátky na "YYYY-MM"
};

// ===== Helper for category deletion =====
function remapDeletedCategories(
  transactions: { category: string }[],
  removedNames: string[]
) {
  const del = new Set(removedNames || []);
  return transactions.map((t) => (del.has(t.category) ? { ...t, category: "-" } : t));
}

// ===== Defaults (no envelopes, no fixed) =====
const G_INCOME = "Příjem";
const G_NEEDS = "Potřeby";
const G_WANTS = "Přání";
const G_SAVINGS = "Úspory";

const DEFAULT_CATEGORIES = [
  // Incomes
  { name: "Mzda", group: G_INCOME },
  { name: "Jiné příjmy", group: G_INCOME },
  // Needs
  { name: "Nájem / hypotéka", group: G_NEEDS },
  { name: "Energie", group: G_NEEDS },
  { name: "Jídlo - domácnost", group: G_NEEDS },
  { name: "Doprava", group: G_NEEDS },
  { name: "Pojištění", group: G_NEEDS },
  { name: "Zdraví / léky", group: G_NEEDS },
  // Wants
  { name: "Stravování venku", group: G_WANTS },
  { name: "Zábava", group: G_WANTS },
  { name: "Nákupy / oblečení", group: G_WANTS },
  { name: "Předplatné", group: G_WANTS },
  // Savings
  { name: "Nouzový fond", group: G_SAVINGS },
  { name: "Důchod / investice", group: G_SAVINGS },
  { name: "Cestování (sinking fund)", group: G_SAVINGS },
  { name: "Údržba bytu / auta (sinking fund)", group: G_SAVINGS },
];

const DEFAULT_ACCOUNTS = ["Běžný účet", "Spořicí účet", "Hotovost", "Společný účet"];

const STORAGE_KEY = "mini-budget-v1";

type SortKey = "date" | "account" | "amount" | "category";

export default function BudgetApp() {
  // ===== State =====
  const now = new Date();
  const [month, setMonth] = useState<string>(ym(now));
  const [accounts, setAccounts] = useState<string[]>(DEFAULT_ACCOUNTS);
  const [categories, setCategories] = useState<{ name: string; group: string }[]>(
    DEFAULT_CATEGORIES
  );
  const [transactions, setTransactions] = useState<any[]>([]);
  // Recurrings
  const [recurrings, setRecurrings] = useState<any[]>([]); // {id,name,category,amount,day,active}
  const [snoozed, setSnoozed] = useState<string[]>([]); // ids snoozed for current session
  const [ui, setUi] = useState({
    showTxModal: false,
    showCatModal: false,
    showRecModal: false,
    promptRecurring: null as any | null,
    editingTx: null as any | null,
  });

  const changeMonthBy = (delta: number) => {
    setMonth((prev) => shiftMonth(prev, delta));
  };

  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>(
    { key: "date", dir: "desc" }
  );

  // ===== Load from localStorage =====
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.month) setMonth(data.month);
      if (data.accounts) setAccounts(data.accounts);
      if (data.categories) {
        // normalize: keep only name + group, drop old envelope/fixed if exist
        setCategories(
          data.categories.map((c: any) => ({
            name: c.name,
            group: c.group || G_NEEDS,
          }))
        );
      }
      if (data.transactions) setTransactions(data.transactions);
      if (data.recurrings) setRecurrings(data.recurrings);
    } catch (e) {
      console.error("Load LS", e);
    }
  }, []);

  // ===== Save to localStorage =====
  useEffect(() => {
    const payload = JSON.stringify({ month, accounts, categories, transactions, recurrings });
    localStorage.setItem(STORAGE_KEY, payload);
  }, [month, accounts, categories, transactions, recurrings]);

  // ===== Derived =====
  const monthStart = useMemo(
    () => new Date(Number(month.slice(0, 4)), Number(month.slice(5)) - 1, 1),
    [month]
  );
  const monthEnd = useMemo(
    () => new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0),
    [month]
  );

  const prevMonth = useMemo(() => shiftMonth(month, -1), [month]);

  const prevMonthStart = useMemo(
    () => new Date(Number(prevMonth.slice(0, 4)), Number(prevMonth.slice(5)) - 1, 1),
    [prevMonth]
  );
  const prevMonthEnd = useMemo(
    () => new Date(Number(prevMonth.slice(0, 4)), Number(prevMonth.slice(5)), 0),
    [prevMonth]
  );

  const prevMonthTx = useMemo(
    () =>
      transactions.filter((t) => {
        const d = new Date(t.date);
        return d >= prevMonthStart && d <= prevMonthEnd;
      }),
    [transactions, prevMonthStart, prevMonthEnd]
  );

  const monthTx = useMemo(
    () =>
      transactions.filter((t) => {
        const d = parseLocalDate(t.date);
        return d >= monthStart && d <= monthEnd;
      }),
    [transactions, monthStart, monthEnd]
  );

  const groupMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.name, c.group));
    return m;
  }, [categories]);

  const totals = useMemo(() => {
    const res: any = {
      [G_INCOME]: 0,
      [G_NEEDS]: 0,
      [G_WANTS]: 0,
      [G_SAVINGS]: 0,
      vydaje: 0,
      saldo: 0,
    };
    monthTx.forEach((t) => {
      const group = groupMap.get(t.category) || "";
      const value = Number(t.amount || 0);
      if (group === G_INCOME) {
        res[G_INCOME] += value > 0 ? value : -value;
      } else if (group) {
        res[group] += Math.abs(value);
        res.vydaje += Math.abs(value);
      }
    });
    res.saldo = res[G_INCOME] - res.vydaje;
    return res;
  }, [monthTx, groupMap]);

  const prevTotals = useMemo(() => {
    const res: any = {
      [G_INCOME]: 0,
      [G_NEEDS]: 0,
      [G_WANTS]: 0,
      [G_SAVINGS]: 0,
      vydaje: 0,
      saldo: 0,
    };
    prevMonthTx.forEach((t) => {
      const group = groupMap.get(t.category) || "";
      const value = Number(t.amount || 0);
      if (group === G_INCOME) {
        res[G_INCOME] += value > 0 ? value : -value;
      } else if (group) {
        res[group] += Math.abs(value);
        res.vydaje += Math.abs(value);
      }
    });
    res.saldo = res[G_INCOME] - res.vydaje;
    return res;
  }, [prevMonthTx, groupMap]);

  // ===== Pie data (spend by category, no income) =====
  const spendByCategory = useMemo(() => {
    const m = new Map<string, number>();
    monthTx.forEach((t) => {
      const g = groupMap.get(t.category);
      if (!g || g === G_INCOME) return;
      const v = Math.abs(Number(t.amount || 0));
      if (!v) return;
      m.set(t.category, (m.get(t.category) || 0) + v);
    });
    return Array.from(m, ([name, value]) => ({ name, value }));
  }, [monthTx, groupMap]);

  const pieData = useMemo(() => {
    const arr = [...spendByCategory].sort((a, b) => b.value - a.value);
    const total = arr.reduce((s, i) => s + i.value, 0);
    if (!total) return [];
    const head = arr.slice(0, 8);
    const tailSum = arr.slice(8).reduce((s, i) => s + i.value, 0);
    return tailSum > 0 ? [...head, { name: "Ostatní", value: tailSum }] : head;
  }, [spendByCategory]);

  const sortedMonthTx = useMemo(() => {
    const items = [...monthTx];
  
    const getSignedAmount = (t: any) => {
      const g = groupMap.get(t.category);
      const isIncome = g === G_INCOME;
      const raw = Number(t.amount || 0);
      // příjem +, výdaj -
      return isIncome ? raw : -raw;
    };
  
    items.sort((a, b) => {
      let cmp = 0;
  
      if (sort.key === "date") {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        cmp = da - db;
      } else if (sort.key === "account") {
        const aa = String(a.account || "");
        const ab = String(b.account || "");
        cmp = aa.localeCompare(ab, "cs");
      } else if (sort.key === "amount") {
        const va = getSignedAmount(a);
        const vb = getSignedAmount(b);
        cmp = va - vb;
      } else if (sort.key === "category") {
        const ca = String(a.category || "");
        const cb = String(b.category || "");
        cmp = ca.localeCompare(cb, "cs");
      }
  
      return sort.dir === "asc" ? cmp : -cmp;
    });
  
    return items;
  }, [monthTx, sort, groupMap]);

  const fmtDiff = (n: number) => {
    if (!n) return "beze změny";
    const sign = n > 0 ? "+" : "−";
    // fmt() vrací '1 234 Kč', tak jen nasadíme znaménko
    return `${sign} ${fmt(Math.abs(n))}`;
  };

  const prevLabel = useMemo(() => {
    return prevMonthStart.toLocaleDateString("cs-CZ", {
      month: "long",
      year: "numeric",
    });
  }, [prevMonthStart]);

  const diff = useMemo(
    () => ({
      income: totals[G_INCOME] - prevTotals[G_INCOME],
      expense: totals.vydaje - prevTotals.vydaje,
      saldo: totals.saldo - prevTotals.saldo,
    }),
    [totals, prevTotals]
  );

  // ===== Actions =====
  const addTransaction = (tx: any) => {
    setTransactions((prev) => [{ id: crypto.randomUUID(), ...tx }, ...prev]);
    setUi((u) => ({ ...u, showTxModal: false, editingTx: null }));
  };

  const removeTransaction = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  };

  const startEditTx = (tx: any) => {
    setUi((u) => ({ ...u, showTxModal: true, editingTx: tx }));
  };

  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify({ month, accounts, categories, transactions, recurrings }, null, 2)],
      { type: "application/json" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `domaci-rozpocet-${month}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result || "{}"));
        if (data.month) setMonth(data.month);
        if (data.accounts) setAccounts(data.accounts);
        if (data.categories) {
          setCategories(
            data.categories.map((c: any) => ({ name: c.name, group: c.group || G_NEEDS }))
          );
        }
        if (data.transactions) setTransactions(data.transactions);
        if (data.recurrings) setRecurrings(data.recurrings);
      } catch {
        alert("Soubor nevypadá jako platný JSON export.");
      }
    };
    reader.readAsText(file);
  };

  // ===== Auto-prompts for due recurrings =====
  useEffect(() => {
    if (ui.showTxModal || ui.showCatModal || ui.showRecModal || ui.promptRecurring) return;
    const nowD = new Date();
    if (month !== ym(nowD)) return;
    const y = nowD.getFullYear();
    const m = nowD.getMonth();
    const today = nowD.getDate();
    const pending = recurrings.filter((r) => {
      if (!r || r.active === false) return false;
      if (snoozed.includes(r.id)) return false;
      const due = dueDateFor(y, m, r.day || 1);
      if (today < due.getDate()) return false;
      const exists = monthTx.some((t) => t.metaRecurringId === r.id);
      return !exists;
    });
    if (pending.length) setUi((u) => ({ ...u, promptRecurring: pending[0] }));
  }, [
    month,
    monthTx,
    recurrings,
    snoozed,
    ui.showTxModal,
    ui.showCatModal,
    ui.showRecModal,
    ui.promptRecurring,
  ]);

  // ===== Helpery pro přepínání řazení + ikonka =====
  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sort.key !== column) {
      // sloupec není aktivní – šedé "↕"
      return <span className="ml-1 text-gray-300">↕</span>;
    }
    return (
      <span className="ml-1 text-gray-500">
        {sort.dir === "asc" ? "↑" : "↓"}
      </span>
    );
  };

  // ===== UI components =====
  const MonthComparison = () => {
    // když v předchozím měsíci nic není, nemá smysl obtěžovat
    if (prevMonthTx.length === 0) return null;

    return (
      <div className="mt-4 rounded-2xl bg-gray-50 p-3 text-xs text-gray-700">
        <div className="mb-1 font-medium">
          Oproti {prevLabel}:
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            Příjmy:{" "}
            <span className={diff.income >= 0 ? "text-emerald-700" : "text-red-600"}>
              {fmtDiff(diff.income)}
            </span>
          </div>
          <div>
            Výdaje:{" "}
            <span className={diff.expense <= 0 ? "text-emerald-700" : "text-red-600"}>
              {fmtDiff(diff.expense)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const Header = () => (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="text-2xl font-bold">Domácí rozpočet</h1>
        <p className="text-sm text-gray-500">
          Měsíční přehled a transakce. Všechno jen v prohlížeči.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {/* Měsíc + šipky vedle sebe */}
        <div className="flex items-center gap-2">
          <label className="text-sm">Měsíc</label>

          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-xl border px-3 py-2 text-sm"
          />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => changeMonthBy(-1)}
              title="Předchozí měsíc"
              className="rounded-full border px-2 py-1 text-sm leading-none text-gray-700 hover:bg-gray-100"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => changeMonthBy(1)}
              title="Další měsíc"
              className="rounded-full border px-2 py-1 text-sm leading-none text-gray-700 hover:bg-gray-100"
            >
              ›
            </button>
          </div>
        </div>

        <button
          onClick={() => setUi((u) => ({ ...u, showTxModal: true, editingTx: null }))}
          className="rounded-xl bg-black px-4 py-2 text-white"
        >
          + Transakce
        </button>
        <button
          onClick={() => setUi({ ...ui, showCatModal: true })}
          className="rounded-xl border px-4 py-2"
        >
          Kategorie
        </button>
        <button
          onClick={() => setUi({ ...ui, showRecModal: true })}
          className="rounded-xl border px-4 py-2"
        >
          Pravidelné pohyby
        </button>
        <button onClick={exportJson} className="rounded-xl border px-4 py-2">
          Export
        </button>
        <label className="cursor-pointer rounded-xl border px-4 py-2">
          Import
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
          />
        </label>
      </div>
    </div>
  );

  const StatCard = ({ title, value, sub }: { title: string; value: number; sub?: string }) => (
    <div className="rounded-2xl border p-4 shadow-sm">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-semibold">{fmt(value)}</div>
      {sub != null && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );

  const GroupBox = ({ group, used }: { group: string; used: number }) => (
    <div className="rounded-2xl border p-4">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-sm text-gray-600">{group}</div>
        <div className="text-sm text-gray-900">{fmt(used)}</div>
      </div>
    </div>
  );

  const PieSpending = () => {
    const COLORS = [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ];

    const total = pieData.reduce((s, i) => s + i.value, 0);

    const renderTooltip = (props: any) => {
      const { active, payload } = props;
      if (!active || !payload || !payload.length) return null;
      const item = payload[0];
      const value = Number(item.value || 0);
      const name = item.name || "";
      const percent = total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
      return (
        <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow">
          <div className="font-semibold">{name}</div>
          <div>{fmt(value)}</div>
          <div className="text-gray-500">{percent}% z výdajů</div>
        </div>
      );
    };

    if (!total) {
      return (
        <div className="rounded-2xl border p-4">
          <div className="mb-2 text-sm text-gray-600">Rozdělení výdajů</div>
          <div className="text-sm text-gray-500">
            V tomto měsíci zatím nejsou žádné výdaje.
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-gray-600">Rozdělení výdajů (podle kategorií)</div>
          <div className="text-sm text-gray-600">Celkem: {fmt(total)}</div>
        </div>
        <div className="h-80 w-full">
          <R.ResponsiveContainer width="100%" height="100%">
            <R.PieChart>
              <R.Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={1}
              >
                {pieData.map((_, idx) => (
                  <R.Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                ))}
              </R.Pie>
              <R.Tooltip content={renderTooltip} />
              <R.Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                wrapperStyle={{ fontSize: 12 }}
              />
            </R.PieChart>
          </R.ResponsiveContainer>
        </div>
      </div>
    );
  };

  const TxTable = () => (
    <div className="overflow-auto rounded-2xl border">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="px-3 py-2">
              <button
                type="button"
                onClick={() => toggleSort("date")}
                className="flex items-center gap-1 text-xs font-medium text-gray-700"
              >
                Datum
                <SortIcon column="date" />
              </button>
            </th>
            <th className="px-3 py-2">
              <button
                type="button"
                onClick={() => toggleSort("account")}
                className="flex items-center gap-1 text-xs font-medium text-gray-700"
              >
                Účet
                <SortIcon column="account" />
              </button>
            </th>
            <th className="px-3 py-2">Popis</th>
            <th className="px-3 py-2">
              <button
                type="button"
                onClick={() => toggleSort("category")}
                className="flex items-center gap-1 text-xs font-medium text-gray-700"
              >
                Kategorie
                <SortIcon column="category" />
              </button>
            </th>
            <th className="px-3 py-2">Skupina</th>
            <th className="px-3 py-2 text-right">
              <button
                type="button"
                onClick={() => toggleSort("amount")}
                className="flex w-full items-center justify-end gap-1 text-xs font-medium text-gray-700"
              >
                Částka
                <SortIcon column="amount" />
              </button>
            </th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sortedMonthTx.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                Žádné transakce v tomto měsíci
              </td>
            </tr>
          )}
          {sortedMonthTx.map((t) => {
            const g = groupMap.get(t.category) || "–";
            const isIncome = g === G_INCOME;
            const val = Number(t.amount || 0) * (isIncome ? 1 : -1);

            return (
              <tr key={t.id} className="border-t">
                <td className="whitespace-nowrap px-3 py-2">
                  {parseLocalDate(t.date).toLocaleDateString("cs-CZ")}
                </td>
                <td className="px-3 py-2">{t.account}</td>
                <td className="px-3 py-2">{t.description}</td>
                <td className="px-3 py-2">{t.category}</td>
                <td className="px-3 py-2">{g}</td>
                <td
                  className={`px-3 py-2 text-right ${
                    isIncome ? "text-emerald-700" : "text-gray-900"
                  }`}
                >
                  {fmt(val)}
                </td>
                <td className="px-3 py-2 text-right space-x-2">
                  <button
                    onClick={() => startEditTx(t)}
                    className="text-xs text-blue-600"
                  >
                    Upravit
                  </button>
                  <button
                    onClick={() => removeTransaction(t.id)}
                    className="text-xs text-red-600"
                  >
                    Smazat
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const TxModal = () => {
    const editing = ui.editingTx as any | null;

    const computeDefaultDate = () => {
      if (editing) return String(editing.date).slice(0, 10);

      // nový záznam – použij aktuálně zvolený měsíc + dnešní den (oříznutý na délku měsíce)
      const [yStr, mStr] = month.split("-");
      const y = Number(yStr);
      const m = Number(mStr) - 1;
      const today = new Date();
      const day = Math.min(today.getDate(), daysInMonth(y, m));
      return `${yStr}-${mStr}-${String(day).padStart(2, "0")}`;
    };

    const [date, setDate] = useState<string>(computeDefaultDate());
    const [account, setAccount] = useState<string>(
      editing?.account || accounts[0] || "Běžný účet"
    );
    const [description, setDescription] = useState<string>(editing?.description || "");
    const [category, setCategory] = useState<string>(
      editing?.category || categories[0]?.name || ""
    );
    const [type, setType] = useState<string>(
      editing && (groupMap.get(editing.category) || "") === G_INCOME ? "Příjem" : "Výdaj"
    ); // UI only, zatím logiku nemění
    const [amount, setAmount] = useState<any>(editing?.amount ?? 0);

    const descriptionSuggestions = useMemo(() => {
      const q = description.trim().toLowerCase();
      if (q.length < 2) return []; // nezačínej po jednom písmenu

      // spočítáme četnost popisů
      const freq = new Map<string, number>();

      for (const t of transactions) {
        const raw = String(t.description || "").trim();
        if (!raw) continue;

        const lowered = raw.toLowerCase();
        if (!lowered.includes(q)) continue;   // musí obsahovat hledaný text

        freq.set(raw, (freq.get(raw) || 0) + 1);
      }

      return Array.from(freq.entries())
        .sort((a, b) => {
          const countDiff = b[1] - a[1];            // nejčastější první
          if (countDiff !== 0) return countDiff;
          return a[0].localeCompare(b[0], "cs");    // při shodě abecedně
        })
        .slice(0, 8)                                // max 8 návrhů
        .map(([label]) => label);                   // vrátíme jen text
    }, [description, transactions]);

    const submit = () => {
      if (!category || !amount) return;
      const isIncome = (groupMap.get(category) || "") === G_INCOME;
      const val = Math.abs(Number(amount || 0));

      if (editing) {
        // úprava existující transakce
        setTransactions((prev) =>
          prev.map((t) =>
            t.id === editing.id
              ? { ...t, date, account, description, category, amount: val }
              : t
          )
        );
        setUi((u) => ({ ...u, showTxModal: false, editingTx: null }));
      } else {
        // nová transakce (původní chování)
        addTransaction({
          date,
          account,
          description,
          category,
          amount: isIncome ? val : val,
        });
      }
    };

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
        <div className="w-full max-w-xl rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {editing ? "Upravit transakci" : "Nová transakce"}
            </h3>
            <button
              onClick={() =>
                setUi((u) => ({ ...u, showTxModal: false, editingTx: null }))
              }
              className="text-sm text-gray-500"
            >
              Zavřít
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-sm">Datum</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Účet</label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
              >
                {accounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-sm">Popis</label>
              <div className="relative">
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                  placeholder="Nákup potravin / Výplata…"
                />
                {descriptionSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 max-h-40 w-full overflow-auto rounded-xl border bg-white text-xs shadow">
                    {descriptionSuggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setDescription(s)}
                        className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-gray-100"
                      >
                        <span>{s}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Kategorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
              >
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.group})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Typ</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
              >
                <option>Výdaj</option>
                <option>Příjem</option>
              </select>
            </div>
            <div className="grid gap-1 md:col-span-2">
              <label className="text-sm">Částka (Kč)</label>
              <input
                type="number"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border px-3 py-2"
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={() =>
                setUi((u) => ({ ...u, showTxModal: false, editingTx: null }))
              }
              className="rounded-xl border px-4 py-2"
            >
              Zrušit
            </button>
            <button
              onClick={submit}
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              {editing ? "Uložit změny" : "Přidat"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const CatModal = () => {
    const [local, setLocal] = useState(categories);
    const [newCat, setNewCat] = useState({ name: "", group: G_NEEDS });

    const setField = (idx: number, key: "name" | "group", val: string) =>
      setLocal((prev) => prev.map((c, i) => (i === idx ? { ...c, [key]: val } : c)));

    const add = () => {
      if (!newCat.name) return;
      setLocal((prev) => [...prev, { name: newCat.name, group: newCat.group }]);
      setNewCat({ name: "", group: G_NEEDS });
    };

    const removeRow = (idx: number) => {
      setLocal((prev) => prev.filter((_, i) => i !== idx));
    };

    const save = () => {
      const next = local.map((c) => ({ name: c.name, group: c.group || G_NEEDS }));
      const oldNames = new Set(categories.map((c) => c.name));
      const newNames = new Set(next.map((c) => c.name));
      const removed = Array.from(oldNames).filter((n) => !newNames.has(n));
      if (removed.length) {
        setTransactions((prev) => remapDeletedCategories(prev, removed));
        setRecurrings((prev) =>
          prev.map((r) => (removed.includes(r.category) ? { ...r, category: "" } : r))
        );
      }
      setCategories(next);
      setUi((u) => ({ ...u, showCatModal: false }));
    };

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
        <div className="h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Kategorie</h3>
            <button
              onClick={() => setUi({ ...ui, showCatModal: false })}
              className="text-sm text-gray-500"
            >
              Zavřít
            </button>
          </div>

          <div className="mb-4 rounded-xl border p-3">
            <div className="mb-2 text-sm font-medium">Přidat kategorii</div>
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className="rounded-xl border px-3 py-2"
                placeholder="Název"
                value={newCat.name}
                onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
              />
              <select
                className="rounded-xl border px-3 py-2"
                value={newCat.group}
                onChange={(e) => setNewCat({ ...newCat, group: e.target.value })}
              >
                <option>{G_INCOME}</option>
                <option>{G_NEEDS}</option>
                <option>{G_WANTS}</option>
                <option>{G_SAVINGS}</option>
              </select>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={add}
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                Přidat
              </button>
            </div>
          </div>

          <div className="h-[48vh] overflow-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2">Název</th>
                  <th className="px-3 py-2">Skupina</th>
                  <th className="px-3 py-2 text-right">Smazat</th>
                </tr>
              </thead>
              <tbody>
                {local.map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-lg border px-2 py-1"
                        value={c.name}
                        onChange={(e) => setField(i, "name", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="rounded-lg border px-2 py-1"
                        value={c.group}
                        onChange={(e) => setField(i, "group", e.target.value)}
                      >
                        <option>{G_INCOME}</option>
                        <option>{G_NEEDS}</option>
                        <option>{G_WANTS}</option>
                        <option>{G_SAVINGS}</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-xs text-red-600"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={() => setUi({ ...ui, showCatModal: false })}
              className="rounded-xl border px-4 py-2"
            >
              Zrušit
            </button>
            <button
              onClick={save}
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              Uložit
            </button>
          </div>
        </div>
      </div>
    );
  };

  const RecurringModal = () => {
    const [local, setLocal] = useState(recurrings);
    const [newRec, setNewRec] = useState({
      name: "",
      category: categories[0]?.name || "",
      amount: 0,
      day: 1,
      active: true,
    });

    const update = (idx: number, key: string, val: any) =>
      setLocal((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));

    const add = () => {
      if (!newRec.name || !newRec.category) return;
      const rec = {
        id: crypto.randomUUID(),
        ...newRec,
        amount: Number(newRec.amount || 0),
        day: Number(newRec.day || 1),
        active: !!newRec.active,
      };
      setLocal((prev) => [rec, ...prev]);
      setNewRec({
        name: "",
        category: categories[0]?.name || "",
        amount: 0,
        day: 1,
        active: true,
      });
    };

    const removeRow = (idx: number) => {
      setLocal((prev) => prev.filter((_, i) => i !== idx));
    };

    const save = () => {
      setRecurrings(local);
      setUi((u) => ({ ...u, showRecModal: false }));
    };

    const monthlyTotal = local.reduce(
      (sum: number, r: any) => (r.active ? sum + Number(r.amount || 0) : sum),
      0
    );

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
        <div className="h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Pravidelné pohyby</h3>
            <button
              onClick={() => setUi((u) => ({ ...u, showRecModal: false }))}
              className="text-sm text-gray-500"
            >
              Zavřít
            </button>
          </div>

          <div className="mb-4 rounded-xl border p-3">
            <div className="mb-2 text-sm font-medium">Přidat položku</div>
            <div className="mb-1 hidden text-xs text-gray-600 md:flex md:flex-row md:gap-2">
              <div className="flex-1 min-w-[200px]">Název</div>
              <div className="w-40 shrink-0">Kategorie</div>
              <div className="w-28 shrink-0">Částka</div>
              <div className="w-16 shrink-0">Den v měsíci</div>
              <div className="w-20 shrink-0 text-center">Aktivní</div>
            </div>
            <div className="flex flex-col gap-2 md:flex-row">
              <input
                className="flex-1 min-w-[200px] rounded-xl border px-3 py-2"
                placeholder="Název"
                value={newRec.name}
                onChange={(e) => setNewRec({ ...newRec, name: e.target.value })}
              />
              <select
                className="w-full shrink-0 rounded-xl border px-3 py-2 md:w-40"
                value={newRec.category}
                onChange={(e) => setNewRec({ ...newRec, category: e.target.value })}
              >
                {categories.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="w-full shrink-0 rounded-xl border px-3 py-2 text-right md:w-28"
                placeholder="Částka"
                value={newRec.amount}
                onChange={(e) => setNewRec({ ...newRec, amount: Number(e.target.value) })}
              />
              <input
                type="number"
                className="w-full shrink-0 rounded-xl border px-3 py-2 text-center md:w-16"
                placeholder="Den"
                value={newRec.day}
                onChange={(e) => setNewRec({ ...newRec, day: Number(e.target.value) })}
              />
              <label className="flex w-full shrink-0 items-center justify-center gap-1 text-xs text-gray-600 md:w-20">
                <input
                  type="checkbox"
                  checked={!!newRec.active}
                  onChange={(e) => setNewRec({ ...newRec, active: e.target.checked })}
                />
                Aktivní
              </label>
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={add}
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                Přidat
              </button>
            </div>
          </div>

          <div className="h-[48vh] overflow-auto rounded-xl border">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-3 py-2">Název</th>
                  <th className="px-3 py-2">Kategorie</th>
                  <th className="px-3 py-2 text-right">Částka</th>
                  <th className="px-3 py-2 text-right">Den</th>
                  <th className="px-3 py-2">Aktivní</th>
                  <th className="px-3 py-2 text-right">Smazat</th>
                </tr>
              </thead>
              <tbody>
                {local.map((r: any, i: number) => (
                  <tr key={r.id || i} className="border-t">
                    <td className="px-3 py-2">
                      <input
                        className="w-full rounded-lg border px-2 py-1"
                        value={r.name}
                        onChange={(e) => update(i, "name", e.target.value)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        className="w-full rounded-lg border px-2 py-1"
                        value={r.category}
                        onChange={(e) => update(i, "category", e.target.value)}
                      >
                        {categories.map((c) => (
                          <option key={c.name} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-full rounded-lg border px-2 py-1 text-right"
                        value={r.amount}
                        onChange={(e) => update(i, "amount", Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        className="w-full rounded-lg border px-2 py-1 text-right"
                        value={r.day}
                        onChange={(e) => update(i, "day", Number(e.target.value))}
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={!!r.active}
                        onChange={(e) => update(i, "active", e.target.checked)}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="text-xs text-red-600"
                      >
                        Smazat
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-gray-700">
              Celkem měsíčně (aktivní):{" "}
              <span className="font-semibold">{fmt(monthlyTotal)}</span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setUi((u) => ({ ...u, showRecModal: false }))}
                className="rounded-xl border px-4 py-2"
              >
                Zrušit
              </button>
              <button
                onClick={save}
                className="rounded-xl bg-black px-4 py-2 text-white"
              >
                Uložit
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const RecurringConfirm = () => {
    const r = ui.promptRecurring as any;
    const [amount, setAmount] = useState<any>(r?.amount || 0);
    const [account, setAccount] = useState<string>(accounts[0] || "Běžný účet");
    if (!r) return null;

    const confirm = () => {
      const date = todayLocalString();
      addTransaction({
        date,
        account,
        description: `${r.name} (pravidelný)`,
        category: r.category,
        amount: Math.abs(Number(amount || 0)),
        metaRecurringId: r.id,
      });
      setUi((u) => ({ ...u, promptRecurring: null }));
    };

    const later = () => {
      setSnoozed((s) => [...s, r.id]);
      setUi((u) => ({ ...u, promptRecurring: null }));
    };

    return (
      <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-lg font-semibold">Potvrdit platbu?</h3>
            <button
              onClick={() => setUi((u) => ({ ...u, promptRecurring: null }))}
              className="text-sm text-gray-500"
            >
              Zavřít
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-gray-500">Položka:</span> {r.name}
            </div>
            <div>
              <span className="text-gray-500">Kategorie:</span> {r.category}
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Částka</label>
              <input
                type="number"
                className="rounded-xl border px-3 py-2"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-sm">Účet</label>
              <select
                className="rounded-xl border px-3 py-2"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
              >
                {accounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              onClick={later}
              className="rounded-xl border px-4 py-2"
            >
              Později
            </button>
            <button
              onClick={confirm}
              className="rounded-xl bg-black px-4 py-2 text-white"
            >
              Potvrdit
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ===== Render =====
  return (
    <div className="mx-auto max-w-6xl p-4 md:p-6">
      <Header />

      <MonthComparison />

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <StatCard title="Příjmy (měsíc)" value={totals[G_INCOME]} />
        <StatCard title="Výdaje (měsíc)" value={totals.vydaje} />
        <StatCard
          title="Saldo"
          value={totals.saldo}
          sub={
            totals.saldo >= 0
              ? "Přebytkový měsíc. Dobrá práce."
              : "Deficit. Omez Přání nebo přidej Příjem."
          }
        />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <GroupBox group={G_NEEDS} used={totals[G_NEEDS]} />
        <GroupBox group={G_WANTS} used={totals[G_WANTS]} />
        <GroupBox group={G_SAVINGS} used={totals[G_SAVINGS]} />
      </div>

      <div className="mt-6">
        <PieSpending />
      </div>

      <div className="mt-6">
        <TxTable />
      </div>

      {ui.showTxModal && <TxModal />}
      {ui.showCatModal && <CatModal />}
      {ui.showRecModal && <RecurringModal />}
      {ui.promptRecurring && <RecurringConfirm />}

      <footer className="mt-8 text-center text-xs text-gray-500">
        Data se ukládají jen lokálně v prohlížeči. Export/Import viz tlačítka nahoře.
      </footer>
    </div>
  );
}

// ===== Tiny runtime tests (dev) =====
try {
  console.assert(ym(new Date(2025, 0, 1)) === "2025-01", "ym() failed for January");
  console.assert(
    daysInMonth(2024, 1) === 29,
    "daysInMonth() failed for Feb 2024 (leap year)"
  );
  console.assert(typeof fmt(1000) === "string", "fmt() should return string");
  {
    const prev = shiftMonth("2025-01", -1);
    const next = shiftMonth("2025-01", 1);
    console.assert(prev === "2024-12" && next === "2025-02", "shiftMonth() failed");
  }
  {
    const tx = [{ category: "A" }, { category: "B" }, { category: "C" }];
    const out = remapDeletedCategories(tx, ["B", "Z"]);
    console.assert(out[0].category === "A", "remap: unaffected item changed");
    console.assert(out[1].category === "-", "remap: deleted category not mapped to \'-\'");
    console.assert(out[2].category === "C", "remap: wrong mapping for non-deleted");
  }
} catch {
  // ignore in prod
}
