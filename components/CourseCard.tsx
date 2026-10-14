"use client";

import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  BarChart3,
  Layers,
  GraduationCap,
  CheckCircle2,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { type Course, getTotalItemsCount } from "@/lib/data";

interface CourseCardProps {
  course: Course;
  isEnrolled?: boolean;
  progressPercent?: number;
  completedCount?: number;
  totalCount?: number;
  onEnroll?: (courseId: string) => void;
}

export default function CourseCard({
  course,
  isEnrolled = false,
  progressPercent = 0,
  completedCount = 0,
  totalCount,
  onEnroll,
}: CourseCardProps) {
  const router = useRouter();

  const isCpp = course.language.toLowerCase().includes("c++");
  const isPython = course.language.toLowerCase().includes("python");

  const totalItems = totalCount ?? getTotalItemsCount(course);
  const totalTopics = course.topics.length;
  const isCompleted = progressPercent === 100;

  const handleAction = () => {
    if (!isEnrolled && onEnroll) {
      onEnroll(course.id);
    }
    router.push(`/course/${course.id}`);
  };

  return (
    <div className="group relative rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-blue-500/50 backdrop-blur-md p-6 flex flex-col justify-between transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/10 hover:-translate-y-1">
      {/* Decorative gradient glow on hover */}
      <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-blue-600/5 via-indigo-600/0 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                isCpp
                  ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                  : isPython
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-slate-800 text-slate-300 border-slate-700"
              }`}
            >
              {course.language}
            </span>

            {isEnrolled && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                  isCompleted
                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                    : "bg-blue-500/10 text-blue-300 border-blue-500/20"
                }`}
              >
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    <span>Завершен</span>
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-3 h-3 text-blue-400" />
                    <span>В процессе</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <BarChart3 className="w-3.5 h-3.5 text-slate-500" />
            <span>{course.level}</span>
          </div>
        </div>

        {/* Course Title */}
        <h3 className="text-xl font-bold text-white mb-2.5 group-hover:text-blue-300 transition-colors line-clamp-2">
          {course.title}
        </h3>

        {/* Course Description */}
        <p className="text-sm text-slate-400 leading-relaxed mb-6 line-clamp-3">
          {course.description}
        </p>
      </div>

      {/* Progress Bar (if enrolled) */}
      {isEnrolled && (
        <div className="mb-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
            <span className="font-medium">Прогресс освоения:</span>
            <span className="font-mono font-bold text-blue-400">
              {completedCount}/{totalItems} ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-1.5 rounded-full transition-all duration-500 ${
                isCompleted ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-indigo-500"
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Footer */}
      <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between mt-auto gap-3">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>{totalTopics} тем</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-slate-500" />
            <span>{totalItems} уроков</span>
          </div>
        </div>

        {/* Action Button */}
        {isEnrolled ? (
          <button
            onClick={handleAction}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 shadow-md shadow-blue-600/20 hover:shadow-blue-500/30 transition-all duration-150 active:scale-95"
          >
            <span>{isCompleted ? "Повторить" : "Продолжить"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <button
            onClick={handleAction}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600 border border-blue-500/25 hover:border-blue-500 shadow-sm transition-all duration-150 active:scale-95 group-hover:bg-blue-600 group-hover:text-white"
          >
            <GraduationCap className="w-4 h-4" />
            <span>Поступить на курс</span>
          </button>
        )}
      </div>
    </div>
  );
}
