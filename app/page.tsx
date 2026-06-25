"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import WeeklyChart from "./components/WeeklyChart";

type AuthMode = "login" | "register" | "reset" | "update-password";
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

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = (day + 6) % 7; // Monday-based week
  start.setDate(start.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  return start;
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
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
    } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);

      if (event === "PASSWORD_RECOVERY") {
        setMode("update-password");
        setPassword("");
        setConfirmPassword("");
        setNotice({
          type: "success",
          text: "Enter a new password to finish resetting your account."
        });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const storedTheme = window.localStorage.getItem("runners-diary-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setTheme(storedTheme === "dark" || (!storedTheme && prefersDark) ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("runners-diary-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

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

    if (mode === "update-password") {
      if (password.length < 6) {
        setLoading(false);
        setNotice({
          type: "error",
          text: "Password must be at least 6 characters."
        });
        return;
      }

      if (password !== confirmPassword) {
        setLoading(false);
        setNotice({ type: "error", text: "Passwords do not match." });
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password
      });

      setLoading(false);

      if (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }

      await supabase.auth.signOut();
      setUser(null);
      setPassword("");
      setConfirmPassword("");
      setMode("login");
      setNotice({
        type: "success",
        text: "Password updated. Log in with your new password."
      });
      return;
    }

    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: window.location.origin
      });

      setLoading(false);

      if (error) {
        setNotice({ type: "error", text: error.message });
        return;
      }

      setNotice({
        type: "success",
        text: "If an account exists for this email, a password reset link has been sent."
      });
      return;
    }

    if (mode === "register") {
      if (password.length < 6) {
        setLoading(false);
        setNotice({ type: "error", text: "Password must be at least 6 characters." });
        return;
      }

      if (password !== confirmPassword) {
        setLoading(false);
        setNotice({ type: "error", text: "Passwords do not match." });
        return;
      }

      if (!trimmedDisplayName) {
        setLoading(false);
        setNotice({ type: "error", text: "Display name is required." });
        return;
      }

      const { data, error } = await supabase.auth.signUp({
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

      if (data.user?.identities?.length === 0) {
        setNotice({
          type: "error",
          text: "An account already exists for this email. Log in with the original password or reset it."
        });
        setPassword("");
        setConfirmPassword("");
        return;
      }

      setNotice({
        type: "success",
        text: "If this email is new, your account was created. If it already exists, log in with the original password or reset it."
      });
      setPassword("");
      setConfirmPassword("");
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

  if (user && mode !== "update-password") {
    return (
      <DiaryDashboard
        user={user}
        onSignOut={handleSignOut}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
    );
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
          <h2>
            {mode === "login"
              ? "Welcome back"
              : mode === "register"
                ? "Create your account"
                : mode === "reset"
                  ? "Reset your password"
                  : "Choose a new password"}
          </h2>
          <p>
            {mode === "login"
              ? "Sign in to continue your running diary."
              : mode === "register"
                ? "Register to start tracking your runs by date."
                : mode === "reset"
                  ? "Enter your email and we will send a reset link if the account exists."
                  : "Create a new password for your Runner's Diary account."}
          </p>

          {mode !== "update-password" ? (
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
          ) : null}

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

            {mode !== "update-password" ? (
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
            ) : null}

            {mode !== "reset" ? (
              <div className="field">
                <label htmlFor="password">
                  {mode === "update-password" ? "New password" : "Password"}
                </label>
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
            ) : null}

            {(mode === "register" || mode === "update-password") ? (
              <div className="field">
                <label htmlFor="confirmPassword">
                  {mode === "update-password" ? "Confirm new password" : "Confirm password"}
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={6}
                  required
                />
              </div>
            ) : null}

            <button className="submit-button" type="submit" disabled={loading}>
              {loading
                ? "Please wait..."
                : mode === "login"
                  ? "Log in"
                  : mode === "register"
                    ? "Create account"
                    : mode === "reset"
                      ? "Send reset link"
                      : "Update password"}
            </button>

            {mode === "login" ? (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("reset");
                  setNotice(null);
                  setPassword("");
                }}
              >
                Forgot password?
              </button>
            ) : null}

            {mode === "reset" ? (
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setMode("login");
                  setNotice(null);
                }}
              >
                Back to log in
              </button>
            ) : null}
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
  onSignOut,
  theme,
  onToggleTheme
}: {
  user: User;
  onSignOut: () => Promise<void>;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const todayKey = formatDateKey(new Date());
  const displayName =
    (user.user_metadata as { display_name?: string })?.display_name || user.email || "Runner";
  const [monthDate, setMonthDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [runs, setRuns] = useState<RunEntry[]>([]);
  const [form, setForm] = useState<RunForm>(emptyRunForm);
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [monthlyGoalKm, setMonthlyGoalKm] = useState(100);
  const [monthlyGoalInput, setMonthlyGoalInput] = useState("100");
  const [accountAction, setAccountAction] = useState<"delete" | "reset" | null>(null);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [accountActionLoading, setAccountActionLoading] = useState(false);

  function validateConfirmEmailFormat(email: string) {
    const typed = email.trim().toLowerCase();
    if (!typed) return "Please enter your email.";
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(typed);
    if (!emailValid) return "Please enter a valid email address.";
    return null;
  }

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
  const currentMonthLabel = monthFormatter.format(monthDate);
  const monthlyGoalStorageKey = `runners-diary-monthly-goal-${user.id}-${monthDate.getFullYear()}-${String(
    monthDate.getMonth() + 1
  ).padStart(2, "0")}`;
  const today = new Date();
  const weekStart = getWeekStart(today);
  const yearStart = new Date(today.getFullYear(), 0, 1);

  const weekRuns = runs.filter((run) => {
    const runDate = parseDateKey(run.run_date);
    return runDate >= weekStart && runDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
  const weekDistance = weekRuns.reduce((total, run) => total + run.distance_km, 0);

  const yearRuns = runs.filter((run) => {
    const runDate = parseDateKey(run.run_date);
    return runDate >= yearStart && runDate.getFullYear() === today.getFullYear();
  });
  const yearDistance = yearRuns.reduce((total, run) => total + run.distance_km, 0);

  const paceRuns = runs.filter(
    (run) => run.duration_minutes !== null && run.duration_minutes > 0 && run.distance_km > 0
  );
  const totalPaceSeconds = paceRuns.reduce(
    (total, run) => total + (run.duration_minutes ?? 0) * 60,
    0
  );
  const totalPaceDistance = paceRuns.reduce((total, run) => total + run.distance_km, 0);
  const averagePace =
    totalPaceDistance > 0
      ? calculatePace(totalPaceDistance, totalPaceSeconds / 60)
      : "N/A";

  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const key = formatDateKey(date);
    const distance = runsByDate[key]?.reduce((sum, run) => sum + run.distance_km, 0) ?? 0;
    return {
      label: date.toLocaleDateString("en", { weekday: "short" }),
      distance,
      dateKey: key
    };
  });
  const maxGraphDistance = Math.max(...lastSevenDays.map((data) => data.distance), 5);

  const monthDayTotals = monthRuns.reduce<Record<string, number>>((totals, run) => {
    totals[run.run_date] = (totals[run.run_date] ?? 0) + run.distance_km;
    return totals;
  }, {});

  const bestDayThisMonth = Object.entries(monthDayTotals).reduce(
    (best, [dateKey, distance]) => {
      if (!best || distance > best.distance) {
        return { dateKey, distance };
      }
      return best;
    },
    null as { dateKey: string; distance: number } | null
  );

  const runDaysThisMonth = new Set(monthRuns.map((run) => run.run_date)).size;
  const monthlyGoalProgress = Math.min(monthDistance / monthlyGoalKm, 1);

  const weekStreak = (() => {
    let streak = 0;
    for (let offset = 0; offset < 30; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const key = formatDateKey(date);
      if ((runsByDate[key]?.length ?? 0) > 0) {
        streak += 1;
      } else {
        break;
      }
    }
    return streak;
  })();

  const badgeTargets = [
    { label: "5 km Badge", distance: 5, threshold: 0.25 },
    { label: "10 km Badge", distance: 10, threshold: 0.5 },
    { label: "21.1 km Badge", distance: 21.1, threshold: 1 },
    { label: "42.2 km Badge", distance: 42.2, threshold: 2 }
  ];

  const earnedBadges = badgeTargets.map((target) => {
    // A run that meets or exceeds the target (minus threshold) should earn the badge.
    // This allows longer runs (e.g. a 42.2 km) to also unlock 21.1, 10, and 5 km badges.
    const earned = monthRuns.some(
      (run) => run.duration_minutes !== null && run.distance_km >= target.distance - target.threshold
    );

    return {
      ...target,
      earned,
      monthLabel: monthFormatter.format(monthDate)
    };
  });

  const monthlyGoalBadge = {
    label: `${monthlyGoalKm} km Goal Badge`,
    earned: monthDistance >= monthlyGoalKm,
    monthLabel: currentMonthLabel
  };

  const bestTargetRuns = [
    { label: "5 km", target: 5, threshold: 0.25 },
    { label: "10 km", target: 10, threshold: 0.5 },
    { label: "21.1 km", target: 21.1, threshold: 1 },
    { label: "42.2 km", target: 42.2, threshold: 2 }
  ].map(({ label, target, threshold }) => {
    const bestRun = runs
      .filter(
        (run) =>
          run.duration_minutes !== null &&
          run.distance_km >= target - threshold &&
          run.distance_km <= target + threshold
      )
      .reduce<RunEntry | null>((best, run) => {
        if (!best || (run.duration_minutes ?? 0) < (best.duration_minutes ?? Infinity)) {
          return run;
        }
        return best;
      }, null);

    return { label, target, bestRun };
  });

  const longestRun = runs.reduce<RunEntry | null>((best, run) => {
    if (!best || run.distance_km > best.distance_km) {
      return run;
    }
    return best;
  }, null);

  const previousWeekStart = new Date(weekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const previousWeekDistance = runs
    .filter((run) => {
      const runDate = parseDateKey(run.run_date);
      return runDate >= previousWeekStart && runDate < weekStart;
    })
    .reduce((total, run) => total + run.distance_km, 0);

  const previousMonthStart = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1);
  const previousMonthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth(), 0);
  const previousMonthDistance = runs
    .filter((run) => {
      const runDate = parseDateKey(run.run_date);
      return runDate >= previousMonthStart && runDate <= previousMonthEnd;
    })
    .reduce((total, run) => total + run.distance_km, 0);

  const distanceDeltaWeek = weekDistance - previousWeekDistance;
  const distanceDeltaMonth = monthDistance - previousMonthDistance;

  const bestWeeklyPaceRun = runs
    .filter((run) => {
      const runDate = parseDateKey(run.run_date);
      return runDate >= weekStart && runDate < new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    })
    .filter((run) => run.duration_minutes !== null && run.duration_minutes > 0)
    .reduce<RunEntry | null>((best, run) => {
      if (!best || (run.duration_minutes ?? 0) < (best.duration_minutes ?? Infinity)) {
        return run;
      }
      return best;
    }, null);

  const suggestedTarget = weekDistance > 0
    ? `Try ${Math.round(weekDistance * 1.1)} km next week`
    : "Add a 5 km run this week";

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
    const savedValue = window.localStorage.getItem(monthlyGoalStorageKey);
    if (savedValue) {
      const parsedGoal = Number(savedValue);
      if (Number.isFinite(parsedGoal) && parsedGoal > 0) {
        setMonthlyGoalKm(parsedGoal);
        setMonthlyGoalInput(savedValue);
      }
    } else {
      setMonthlyGoalInput(String(monthlyGoalKm));
    }
  }, [monthlyGoalStorageKey]);

  function saveMonthlyGoal() {
    const parsedGoal = Number(monthlyGoalInput);

    if (!Number.isFinite(parsedGoal) || parsedGoal <= 0) {
      setNotice({ type: "error", text: "Monthly goal must be a positive number." });
      return;
    }

    setMonthlyGoalKm(parsedGoal);
    window.localStorage.setItem(monthlyGoalStorageKey, String(parsedGoal));
    setNotice({ type: "success", text: `Monthly goal set to ${parsedGoal} km.` });
  }
  async function confirmAccountAction() {
    if (!supabase) {
      setConfirmError(null);
      setNotice({ type: "error", text: "Supabase is not configured. Add the required environment variables." });
      return;
    }

    const expectedEmail = user.email?.trim().toLowerCase() ?? "";
    const typed = confirmEmail.trim().toLowerCase();

    // basic email format check
    const emailValid = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(typed);
    if (!emailValid) {
      setConfirmError("Please enter a valid email address.");
      return;
    }

    if (typed !== expectedEmail) {
      setConfirmError("The email does not match your account.");
      return;
    }

    setConfirmError(null);

    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session?.access_token) {
      setNotice({ type: "error", text: "Unable to verify your session. Please refresh and try again." });
      return;
    }

    setAccountActionLoading(true);
    setNotice(null);

    const endpoint = accountAction === "delete" ? "/api/delete-account" : "/api/reset-account";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          access_token: sessionData.session.access_token,
          email: expectedEmail
        })
      });

      let result = null;
      try {
        result = await response.json();
      } catch (e) {
        // ignore JSON parse errors
      }

      if (!response.ok) {
        setNotice({ type: "error", text: result?.error || "Could not complete the requested action." });
        return;
      }

      if (accountAction === "delete") {
        await onSignOut();
        setNotice({ type: "success", text: "Account and all data deleted." });
      } else {
        setRuns([]);
        setSelectedDate(todayKey);
        setEditingRunId(null);
        setForm(emptyRunForm);
        setNotice({ type: "success", text: "Account has been reset and all run entries removed." });
      }

      setAccountAction(null);
      setConfirmEmail("");
    } catch (err: any) {
      setNotice({ type: "error", text: err?.message || "Network error while performing action." });
    } finally {
      setAccountActionLoading(false);
    }
  }

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
          <p className="muted-text">
            Welcome, <span className="display-name">{displayName}</span>
          </p>
        </div>
        <div className="dashboard-actions">
          <button type="button" className="secondary-button compact" onClick={onToggleTheme}>
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
          <button type="button" className="secondary-button compact" onClick={() => setAccountAction("reset")}>
            Reset account
          </button>
          <button type="button" className="secondary-button compact" onClick={() => setAccountAction("delete")}>
            Delete account
          </button>
          <button type="button" className="secondary-button compact" onClick={onSignOut}>
            Sign out
          </button>
        </div>
      </header>

      {accountAction ? (
        <section className="confirmation-panel" aria-label="Confirm account action">
          <div className="confirmation-card">
            <p className="eyebrow">
              {accountAction === "delete" ? "Delete account" : "Reset account"}
            </p>
            <h2>
              {accountAction === "delete"
                ? "Confirm account deletion"
                : "Confirm account reset"}
            </h2>
            <p>
              {accountAction === "delete"
                ? "This will permanently delete your account, all run entries, profile data, and email address."
                : "This will delete all run entries and reset your account to a fresh state while keeping your login."}
            </p>
            <div className="field">
              <label htmlFor="confirmEmail">Type your email to confirm</label>
              <input
                id="confirmEmail"
                type="email"
                value={confirmEmail}
                onChange={(event) => { setConfirmEmail(event.target.value); setConfirmError(null); }}
                onBlur={() => {
                  const err = validateConfirmEmailFormat(confirmEmail);
                  setConfirmError(err);
                }}
                onKeyDown={async (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    await confirmAccountAction();
                  }
                }}
                required
              />
            </div>
            {confirmError ? (
              <p className="message error" role="status">{confirmError}</p>
            ) : null}

            <div className="confirmation-actions">
              <button
                type="button"
                className={accountAction === "delete" ? "danger-button" : "secondary-button"}
                onClick={confirmAccountAction}
                disabled={accountActionLoading}
              >
                {accountActionLoading
                  ? accountAction === "delete"
                    ? "Deleting..."
                    : "Resetting..."
                  : accountAction === "delete"
                    ? "Confirm delete"
                    : "Confirm reset"}
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setAccountAction(null);
                  setConfirmEmail("");
                }}
                disabled={accountActionLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="stats-row" aria-label="Monthly and yearly run summary">
        <div className="stat-card">
          <span>Total distance this month</span>
          <strong>{monthDistance.toFixed(2)} km</strong>
        </div>
        <div className="stat-card">
          <span>Total distance this week</span>
          <strong>{weekDistance.toFixed(2)} km</strong>
        </div>
        <div className="stat-card">
          <span>Total distance this year</span>
          <strong>{yearDistance.toFixed(2)} km</strong>
        </div>
        <div className="stat-card">
          <span>Average pace</span>
          <strong>{averagePace}</strong>
        </div>
        <div className="stat-card">
          <span>Runs this month</span>
          <strong>{monthRuns.length}</strong>
        </div>
        <div className="stat-card">
          <span>Current streak</span>
          <strong>{weekStreak} days</strong>
        </div>
      </section>

      <section className="goal-row" aria-label="Goals and highlights">
        <div className="stat-card wide-card goal-settings-card">
          <span>Monthly goal progress</span>
          <div className="goal-meter">
            <div className="goal-meter__fill" style={{ width: `${monthlyGoalProgress * 100}%` }} />
          </div>
          <strong>{Math.round(monthlyGoalProgress * 100)}%</strong>
          <div className="goal-input-row">
            <label htmlFor="monthlyGoal">Set goal</label>
            <input
              id="monthlyGoal"
              type="number"
              min="1"
              step="1"
              value={monthlyGoalInput}
              onChange={(event) => setMonthlyGoalInput(event.target.value)}
            />
            <button type="button" className="secondary-button" onClick={saveMonthlyGoal}>
              Save goal
            </button>
          </div>
        </div>
        <div className="stat-card wide-card">
          <span>Best day this month</span>
          <strong>
            {bestDayThisMonth
              ? `${bestDayThisMonth.distance.toFixed(1)} km on ${formatReadableDate(bestDayThisMonth.dateKey)}`
              : "No runs yet"}
          </strong>
        </div>
        <div className="stat-card wide-card">
          <span>Active days this month</span>
          <strong>{runDaysThisMonth} days</strong>
        </div>
      </section>

      <section className="badge-row" aria-label="Earned badges">
        {(earnedBadges.length > 0 || monthlyGoalBadge) ? (
          [...earnedBadges, monthlyGoalBadge].map((badge) => (
            <div
              className={`stat-card badge-card ${badge.earned ? "earned" : "locked"}`}
              key={badge.label}
            >
              <span>{badge.label}</span>
              <strong>{badge.earned ? "Earned" : "Locked"}</strong>
              <small>{badge.monthLabel}</small>
            </div>
          ))
        ) : (
          <div className="stat-card badge-card locked">
            <span>Badges</span>
            <strong>No badges earned yet</strong>
            <small>Complete a target this month</small>
          </div>
        )}
      </section>

      <section className="comparison-row" aria-label="Performance comparisons and suggestions">
        <div className="stat-card comparison-card">
          <span>This week vs last week</span>
          <strong>{weekDistance.toFixed(1)} km</strong>
          <small>{distanceDeltaWeek >= 0 ? "+" : ""}{distanceDeltaWeek.toFixed(1)} km from last week</small>
        </div>
        <div className="stat-card comparison-card">
          <span>This month vs last month</span>
          <strong>{monthDistance.toFixed(1)} km</strong>
          <small>{distanceDeltaMonth >= 0 ? "+" : ""}{distanceDeltaMonth.toFixed(1)} km from last month</small>
        </div>
        <div className="stat-card comparison-card">
          <span>Suggested next target</span>
          <strong>{suggestedTarget}</strong>
        </div>
      </section>

      <section className="best-target-row" aria-label="Best target run times">
        {bestTargetRuns.map(({ label, target, bestRun }) => (
          <div className="stat-card target-card" key={label}>
            <span>Best {label}</span>
            <strong>{bestRun ? bestRun.pace : "No run matched"}</strong>
            {bestRun ? <small>{bestRun.distance_km.toFixed(1)} km recorded</small> : null}
          </div>
        ))}
        <div className="stat-card target-card">
          <span>Longest run</span>
          <strong>{longestRun ? `${longestRun.distance_km.toFixed(1)} km` : "No runs yet"}</strong>
          {longestRun ? <small>{longestRun.pace} pace</small> : null}
        </div>
        <div className="stat-card target-card">
          <span>Best weekly pace</span>
          <strong>{bestWeeklyPaceRun ? bestWeeklyPaceRun.pace : "No runs this week"}</strong>
          {bestWeeklyPaceRun ? <small>{bestWeeklyPaceRun.distance_km.toFixed(1)} km run</small> : null}
        </div>
      </section>

      <section className="run-graph-panel" aria-label="Last 7 days run graph">
        <div className="graph-header">
          <div>
            <p className="eyebrow">Weekly overview</p>
            <h2>Last 7 days</h2>
          </div>
          <p>{weekDistance.toFixed(1)} km this week</p>
        </div>

        <div className="graph-bars">
          <WeeklyChart lastSevenDays={lastSevenDays} maxGraphDistance={maxGraphDistance} />
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
