import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addDays,
  differenceInDays,
  startOfDay,
  getDay
} from 'date-fns';
import { clsx } from 'clsx';
import { useNavigate } from 'react-router-dom';

export const Calendar: React.FC = () => {
  const { cycleLength, periodLength, lastPeriodStart, symptoms, predictedCycleLength } = useAppContext();
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));
  const navigate = useNavigate();

  // Use ML-predicted cycle length for all cycle calculations
  const activeCycleLength = predictedCycleLength;

  const today = startOfDay(new Date());
  const lastPeriodDate = startOfDay(new Date(lastPeriodStart));

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = addDays(monthStart, -getDay(monthStart));
  const endDate = addDays(monthEnd, 6 - getDay(monthEnd));

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  // Calculate predicted periods and fertile windows
  const getDayStatus = (day: Date) => {
    const daysSincePeriod = differenceInDays(day, lastPeriodDate);
    if (daysSincePeriod < 0) return { isPeriod: false, isFertile: false };

    const cycleDay = (daysSincePeriod % activeCycleLength) + 1;
    const isPeriod = cycleDay <= periodLength;
    const ovulationDay = activeCycleLength - 14;
    const isFertile = cycleDay >= ovulationDay - 4 && cycleDay <= ovulationDay + 1;
    return { isPeriod, isFertile };
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 py-4">
      {/* Sidebar / Stats */}
      <div className="w-full lg:w-80 flex flex-col gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-soft dark:border dark:border-slate-800">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today</span>
            <h1 className="text-3xl font-extrabold text-primary">
              Cycle Day {(differenceInDays(today, lastPeriodDate) % activeCycleLength) + 1}
            </h1>
            <p className="text-slate-600 dark:text-slate-300 mt-2">
              {getDayStatus(today).isFertile ? (
                <>Predicted <span className="text-fertile font-bold">Fertile Window</span></>
              ) : getDayStatus(today).isPeriod ? (
                <>Predicted <span className="text-menstrual font-bold">Period</span></>
              ) : (
                <>Follicular Phase</>
              )}
            </p>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5">
              <span className="material-symbols-outlined text-menstrual">calendar_month</span>
              <div className="text-sm">
                <p className="font-bold">Next Period</p>
                <p className="opacity-70">
                  In {activeCycleLength - ((differenceInDays(today, lastPeriodDate) % activeCycleLength) + 1)} days
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-fertile/10">
              <span className="material-symbols-outlined text-fertile">sunny</span>
              <div className="text-sm">
                <p className="font-bold">Ovulation</p>
                <p className="opacity-70">
                  {(() => {
                    const cycleDay = (differenceInDays(today, lastPeriodDate) % activeCycleLength) + 1;
                    const ovulationDay = activeCycleLength - 14;
                    const diff = ovulationDay - cycleDay;
                    if (diff === 0) return 'Today';
                    if (diff === 1) return 'Tomorrow';
                    if (diff > 1) return `In ${diff} days`;
                    return 'Passed';
                  })()}
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate('/log')}
            className="w-full mt-6 bg-primary text-white font-extrabold py-4 rounded-full shadow-glow-primary flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.98] transition-all text-[15px] tracking-wide"
          >
            <span className="material-symbols-outlined">add</span>
            Log Symptoms
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-soft dark:border dark:border-slate-800">
          <h3 className="font-bold mb-1">Legend</h3>
          {activeCycleLength !== cycleLength && (
            <div className="flex items-center gap-2 mb-3 p-2 bg-primary/5 rounded-lg">
              <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
              <p className="text-xs text-primary font-bold">AI Predicted: {activeCycleLength}d cycle</p>
            </div>
          )}
          <div className="space-y-3 mt-3">
            <div className="flex items-center gap-3">
              <div className="size-5 rounded-full border-2 border-dashed border-menstrual flex items-center justify-center">
                <div className="size-1.5 bg-menstrual rounded-full"></div>
              </div>
              <span className="text-sm font-medium">Predicted Period</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-5 rounded-full border-2 border-dotted border-fertile flex items-center justify-center">
                <span className="material-symbols-outlined text-[10px] text-fertile">star</span>
              </div>
              <span className="text-sm font-medium">Fertile Window</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-5 bg-primary/20 rounded-full border border-primary/40"></div>
              <span className="text-sm font-medium">Current Day</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="size-5 rounded-full border border-slate-300 flex items-center justify-center">
                <div className="size-1.5 bg-primary rounded-full"></div>
              </div>
              <span className="text-sm font-medium">Symptoms Logged</span>
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Section */}
      <div className="flex-1">
        <div className="bg-white dark:bg-slate-900 p-4 sm:p-8 rounded-3xl shadow-soft dark:border dark:border-slate-800">
          <div className="flex items-center justify-between mb-8">
            <div className="flex flex-col">
              <h2 className="text-2xl font-extrabold tracking-tight">{format(currentMonth, 'MMMM yyyy')}</h2>
            </div>
            <div className="flex gap-2">
              <button onClick={prevMonth} className="size-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <span className="material-symbols-outlined">chevron_left</span>
              </button>
              <button onClick={nextMonth} className="size-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                <span className="material-symbols-outlined">chevron_right</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 sm:gap-4 text-center">
            {/* Days of Week */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-slate-400 text-xs font-bold uppercase tracking-widest pb-4">{day}</div>
            ))}

            {/* Calendar Grid */}
            {days.map((day, i) => {
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, today);
              const { isPeriod, isFertile } = getDayStatus(day);

              const dateStr = day.toISOString().split('T')[0];
              const daySymptoms = symptoms[dateStr];
              const hasSymptoms = daySymptoms && (
                daySymptoms.mood.length > 0 ||
                daySymptoms.pain.length > 0 ||
                daySymptoms.discharge.length > 0 ||
                daySymptoms.lifestyle.length > 0
              );

              return (
                <div
                  key={i}
                  className={clsx(
                    "h-16 sm:h-24 flex flex-col items-center justify-center rounded-2xl relative cursor-pointer transition-all duration-300",
                    !isCurrentMonth ? "opacity-20" : "",
                    isToday ? "bg-primary text-white shadow-glow-primary z-10 scale-105" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                    !isToday && isPeriod ? "bg-menstrual/5 border-2 border-transparent hover:border-menstrual/40" : "",
                    !isToday && isFertile ? "bg-fertile/5 border-2 border-transparent hover:border-fertile/40" : ""
                  )}
                >
                  <span className={clsx(
                    "text-lg font-bold",
                    !isToday && isPeriod ? "text-menstrual" : "",
                    !isToday && isFertile ? "text-fertile" : ""
                  )}>
                    {format(day, 'd')}
                  </span>

                  {!isToday && isPeriod && (
                    <div className="size-1 bg-menstrual rounded-full absolute bottom-4"></div>
                  )}

                  {isFertile && (
                    <span className={clsx(
                      "material-symbols-outlined text-[10px] absolute bottom-4",
                      !isToday ? "text-fertile" : "text-white"
                    )}>star</span>
                  )}

                  {hasSymptoms && (
                    <div className={clsx(
                      "absolute -top-1 -right-1 size-3 rounded-full flex items-center justify-center",
                      isToday ? "bg-white" : "bg-primary/20"
                    )}>
                      <div className="size-1.5 bg-primary rounded-full"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Secondary Insights */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-soft dark:border dark:border-slate-800 flex items-center gap-4">
            <div className="size-12 bg-fertile/10 rounded-full flex items-center justify-center text-fertile shrink-0">
              <span className="material-symbols-outlined">psychology_alt</span>
            </div>
            <div>
              <h4 className="font-exrabold text-[15px]">Mood Insight</h4>
              <p className="text-[13px] text-slate-500 font-medium">Expect higher energy and social focus today.</p>
            </div>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-soft dark:border dark:border-slate-800 flex items-center gap-4">
            <div className="size-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined">water</span>
            </div>
            <div>
              <h4 className="font-exrabold text-[15px]">Hydration Tip</h4>
              <p className="text-[13px] text-slate-500 font-medium">Drink extra water to support peak cycle phase.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
