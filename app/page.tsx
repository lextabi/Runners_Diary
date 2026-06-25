"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type AuthMode = "login" | "register";
type Notice = {
  type: "success" | "error";
  text: string;
} | null;

type RunEntry = {
  id: string;
  user_id: string;
  run_date: string;
  run_time: string | null;
  distance_km: number;
  pace: string;
  duration_minutes: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type RunForm = {
  runTime: string;
  distanceKm: string;
  durationMinutes: string;
  notes: string;
};

const emptyRunForm: RunForm = {
  runTime: "",
  distanceKm: "",
  durationMinutes: "",
  notes: ""
};

const monthFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric"
});

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatReadableDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(new Date(year, month - 1, day));
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(year, month, 1 - firstDay.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);

    return {
      date,
      dateKey: formatDateKey(date),
      isCurrentMonth: date.getMonth() === month
    };
  });
}

function calculatePace(distanceKm: number, durationMinutes: number) {
  const paceMinutes = durationMinutes / distanceKm;
  const wholeMinutes = Math.floor(paceMinutes);
  const seconds = Math.round((paceMinutes - wholeMinutes) * 60);

  if (seconds === 60) {
    return `${wholeMinutes + 1}:00 / km`;
  }

  return `${wholeMinutes}:${String(seconds).padStart(2, "0")} / km`;
}

export default function Home() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) {
      setNotice({
        type: "error",
        text: "Supabase is not configured. Add the required environment variables."
      });
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setNotice(null);

    if (!supabase) {
      setLoading(false);
      setNotice({
        type: "error",
        text: "Supabase is not configured. Add the required environment variables."
      });
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedDisplayName = displayName.trim();

    if (mode === "register") {
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            display_name: trimmedDisplayName
          }
        }
      });

      setLoading(false);

      if (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }

      setNotice({
        type: "success",
        text: "Account created. Check your email if confirmation is enabled, then sign in."
      });
      setPassword("");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password
    });

    setLoading(false);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    setNotice({ type: "success", text: "You are signed in." });
    setPassword("");
  }

  async function handleSignOut() {
    if (!supabase) {
      return;
    }

    await supabase.auth.signOut();
    setNotice({ type: "success", text: "You are signed out." });
  }

  if (user) {
    return <DiaryDashboard user={user} onSignOut={handleSignOut} />;
  }

  return (
    <main className="login-page">
      <section className="brand-panel" aria-label="Runner's Diary introduction">
        <div className="brand-copy">
          <div className="brand-mark" aria-hidden="true">
            RD
          </div>
          <h1>Runner&apos;s Diary</h1>
          <p>
            Log in to keep every run, rest day, streak, and small win in one
            calendar-built training journal.
          </p>
        </div>
      </section>

      <section className="auth-panel" aria-label="Authentication form">
        <div className="auth-card">
          <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
          <p>
            {mode === "login"
              ? "Sign in to continue your running diary."
              : "Register to start tracking your runs by date."}
          </p>

          <div className="mode-toggle" role="tablist" aria-label="Auth mode">
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setNotice(null);
              }}
            >
              Log in
            </button>
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                setNotice(null);
              }}
            >
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "register" ? (
              <div className="field">
                <label htmlFor="displayName">Display name</label>
                <input
                  id="displayName"
                  name="displayName"
                  type="text"
                  autoComplete="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
            ) : null}

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>

            <button className="submit-button" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : "Create account"}
            </button>
          </form>

          {notice ? (
            <p className={`message ${notice.type}`} role="status">
              {notice.text}
            </p>
          ) : null}

          {!isSupabaseConfigured ? (
            <p className="message error" role="status">
              Missing Supabase environment variables. Check your deployment
              settings.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function DiaryDashboard({
  user,
  onSignOut
}: {
  user: User;
  onSignOut: () => Promise<void>;
}) {
  const todayKey = formatDateKey(new Date());
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [form, setForm] = useState<RunForm>(emptyRunForm);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);

  const calendarDays = useMemo(() => buildCalendarDays(monthDate), [monthDate]);

  const runsByDate = useMemo(() => {
    return runs.reduce<Record<string, RunEntry[]>>((groups, run) => {
      groups[run.run_date] = groups[run.run_date] ?? [];
      groups[run.run_date].push(run);
      return groups;
    }, {});
  }, [runs]);

  const selectedRuns = runsByDate[selectedDate] ?? [];
  const monthRuns = runs.filter((run) => {
    const runDate = new Date(`${run.run_date}T00:00:00`);
    return (
      runDate.getMonth() === monthDate.getMonth() &&
      runDate.getFullYear() === monthDate.getFullYear()
    );
  });
  const monthDistance = monthRuns.reduce((total, run) => total + run.distance_km, 0);
  const previewDistance = Number(form.distanceKm);
  const previewDuration = Number(form.durationMinutes);
  const calculatedPace =
    Number.isFinite(previewDistance) &&
    previewDistance > 0 &&
    Number.isFinite(previewDuration) &&
    previewDuration > 0
      ? calculatePace(previewDistance, previewDuration)
      : "Enter distance and duration";

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    if (!supabase) {
      setLoadingRuns(false);
      setNotice({
        type: "error",
        text: "Supabase is not configured. Add the required environment variables."
      });
      return;
    }

    setLoadingRuns(true);
    const { data, error } = await supabase
      .from("runs")
      .select("*")
      .order("run_date", { ascending: false })
      .order("run_time", { ascending: false });

    setLoadingRuns(false);

    if (error) {
      setNotice({
        type: "error",
        text: "Could not load runs. Make sure the runs table migration has been run in Supabase."
      });
      return;
    }

    setRuns(data ?? []);
  }

  function moveMonth(direction: -1 | 1) {
    setMonthDate((current) => {
      const next = new Date(current);
      next.setMonth(current.getMonth() + direction);
      return next;
    });
  }

  function selectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setEditingRunId(null);
    setForm(emptyRunForm);
    setNotice(null);
  }

  function editRun(run: RunEntry) {
    setSelectedDate(run.run_date);
    setEditingRunId(run.id);
    setForm({
      runTime: run.run_time ?? "",
      distanceKm: String(run.distance_km),
      durationMinutes: run.duration_minutes ? String(run.duration_minutes) : "",
      notes: run.notes ?? ""
    });
    setNotice(null);
  }

  async function saveRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setNotice(null);

    if (!supabase) {
      setSaving(false);
      setNotice({
        type: "error",
        text: "Supabase is not configured. Add the required environment variables."
      });
      return;
    }

    const distance = Number(form.distanceKm);
    const duration = Number(form.durationMinutes);

    if (!Number.isFinite(distance) || distance <= 0) {
      setSaving(false);
      setNotice({ type: "error", text: "Distance must be greater than zero." });
      return;
    }

    if (!Number.isFinite(duration) || duration <= 0) {
      setSaving(false);
      setNotice({ type: "error", text: "Duration must be greater than zero." });
      return;
    }

    const pace = calculatePace(distance, duration);

    const payload = {
      user_id: user.id,
      run_date: selectedDate,
      run_time: form.runTime || null,
      distance_km: distance,
      pace,
      duration_minutes: duration,
      notes: form.notes.trim() || null
    };

    const request = editingRunId
      ? supabase.from("runs").update(payload).eq("id", editingRunId).select().single()
      : supabase.from("runs").insert(payload).select().single();

    const { data, error } = await request;
    setSaving(false);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    setRuns((currentRuns) => {
      if (editingRunId) {
        return currentRuns.map((run) => (run.id === editingRunId ? data : run));
      }

      return [data, ...currentRuns];
    });
    setEditingRunId(null);
    setForm(emptyRunForm);
    setNotice({
      type: "success",
      text: editingRunId ? "Run updated." : "Run saved to your calendar."
    });
  }

  async function deleteRun(runId: string) {
    if (!supabase) {
      setNotice({
        type: "error",
        text: "Supabase is not configured. Add the required environment variables."
      });
      return;
    }

    const shouldDelete = window.confirm("Delete this run entry?");

    if (!shouldDelete) {
      return;
    }

    const { error } = await supabase.from("runs").delete().eq("id", runId);

    if (error) {
      setNotice({ type: "error", text: error.message });
      return;
    }

    setRuns((currentRuns) => currentRuns.filter((run) => run.id !== runId));

    if (editingRunId === runId) {
      setEditingRunId(null);
      setForm(emptyRunForm);
    }

    setNotice({ type: "success", text: "Run deleted." });
  }

  return (
    <main className="diary-page">
      <header className="diary-header">
        <div>
          <p className="eyebrow">Runner&apos;s Diary</p>
          <h1>Training Calendar</h1>
          <p className="muted-text">{user.email}</p>
        </div>
        <button type="button" className="secondary-button compact" onClick={onSignOut}>
          Sign out
        </button>
      </header>

      <section className="stats-row" aria-label="Monthly run summary">
        <div className="stat-card">
          <span>Total distance</span>
          <strong>{monthDistance.toFixed(2)} km</strong>
        </div>
        <div className="stat-card">
          <span>Runs this month</span>
          <strong>{monthRuns.length}</strong>
        </div>
        <div className="stat-card">
          <span>Selected day</span>
          <strong>{selectedRuns.length}</strong>
        </div>
      </section>

      <section className="diary-grid">
        <div className="calendar-panel">
          <div className="calendar-toolbar">
            <button type="button" className="icon-button" onClick={() => moveMonth(-1)}>
              <span aria-hidden="true">&lt;</span>
              <span className="sr-only">Previous month</span>
            </button>
            <h2>{monthFormatter.format(monthDate)}</h2>
            <button type="button" className="icon-button" onClick={() => moveMonth(1)}>
              <span aria-hidden="true">&gt;</span>
              <span className="sr-only">Next month</span>
            </button>
          </div>

          <div className="weekday-row">
            {weekdayLabels.map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>

          <div className="calendar-grid">
            {calendarDays.map(({ date, dateKey, isCurrentMonth }) => {
              const dayRuns = runsByDate[dateKey] ?? [];
              const dayDistance = dayRuns.reduce(
                (total, run) => total + run.distance_km,
                0
              );

              return (
                <button
                  type="button"
                  key={dateKey}
                  className={[
                    "calendar-day",
                    isCurrentMonth ? "" : "outside-month",
                    selectedDate === dateKey ? "selected" : "",
                    dateKey === todayKey ? "today" : "",
                    dayRuns.length > 0 ? "has-run" : ""
                  ].join(" ")}
                  onClick={() => selectDate(dateKey)}
                >
                  <span className="day-number">{date.getDate()}</span>
                  {dayRuns.length > 0 ? (
                    <span className="day-summary">
                      {dayDistance.toFixed(1)} km
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <aside className="entry-panel" aria-label="Selected day run entries">
          <div className="entry-heading">
            <div>
              <p className="eyebrow">Selected Date</p>
              <h2>{formatReadableDate(selectedDate)}</h2>
            </div>
            {editingRunId ? (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setEditingRunId(null);
                  setForm(emptyRunForm);
                }}
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          <form className="run-form" onSubmit={saveRun}>
            <div className="form-row">
              <div className="field">
                <label htmlFor="runTime">Time of run</label>
                <input
                  id="runTime"
                  type="time"
                  value={form.runTime}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      runTime: event.target.value
                    }))
                  }
                />
              </div>
              <div className="field">
                <label htmlFor="distanceKm">Distance (km)</label>
                <input
                  id="distanceKm"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.distanceKm}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      distanceKm: event.target.value
                    }))
                  }
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label htmlFor="durationMinutes">Duration (minutes)</label>
                <input
                  id="durationMinutes"
                  type="number"
                  min="1"
                  step="0.01"
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      durationMinutes: event.target.value
                    }))
                  }
                  required
                />
              </div>
              <div className="pace-preview">
                <span>Pace</span>
                <strong>{calculatedPace}</strong>
              </div>
            </div>

            <div className="field">
              <label htmlFor="notes">Notes</label>
              <input
                id="notes"
                type="text"
                placeholder="Easy run, intervals, weather, route..."
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value
                  }))
                }
              />
            </div>

            <button className="submit-button" type="submit" disabled={saving}>
              {saving ? "Saving..." : editingRunId ? "Update run" : "Save run"}
            </button>
          </form>

          {notice ? (
            <p className={`message ${notice.type}`} role="status">
              {notice.text}
            </p>
          ) : null}

          <div className="runs-list">
            <h3>{loadingRuns ? "Loading runs..." : "Runs on this day"}</h3>
            {selectedRuns.length === 0 && !loadingRuns ? (
              <p className="empty-state">No runs logged for this date yet.</p>
            ) : null}

            {selectedRuns.map((run) => (
              <article className="run-card" key={run.id}>
                <div>
                  <strong>{run.distance_km.toFixed(2)} km</strong>
                  <span>
                    {run.run_time ? `${run.run_time} - ` : ""}
                    {run.pace}
                  </span>
                  {run.duration_minutes ? (
                    <span>{run.duration_minutes} minutes</span>
                  ) : null}
                  {run.notes ? <p>{run.notes}</p> : null}
                </div>
                <div className="run-actions">
                  <button type="button" onClick={() => editRun(run)}>
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteRun(run.id)}>
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
