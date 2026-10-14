"use client";

import { useState, useEffect, useCallback } from "react";
import { type Course, getAllCourseItems } from "@/lib/data";

const COMPLETED_STORAGE_KEY = "devcourses_completed_lessons";
const ENROLLED_STORAGE_KEY = "devcourses_enrolled_courses";

export function useProgress() {
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  const [enrolledCourses, setEnrolledCourses] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Read progress and enrolled courses after mount to prevent hydration mismatch
  useEffect(() => {
    try {
      const savedCompleted = localStorage.getItem(COMPLETED_STORAGE_KEY);
      if (savedCompleted) {
        const parsed = JSON.parse(savedCompleted);
        if (Array.isArray(parsed)) {
          setCompletedLessons(parsed);
        }
      }

      const savedEnrolled = localStorage.getItem(ENROLLED_STORAGE_KEY);
      if (savedEnrolled) {
        const parsed = JSON.parse(savedEnrolled);
        if (Array.isArray(parsed)) {
          setEnrolledCourses(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to read progress from LocalStorage:", error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Mark lesson as complete and persist
  const markLessonComplete = useCallback((lessonId: string) => {
    setCompletedLessons((prev) => {
      if (prev.includes(lessonId)) {
        return prev;
      }
      const updated = [...prev, lessonId];
      try {
        localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save progress to LocalStorage:", error);
      }
      return updated;
    });
  }, []);

  // Enroll in a course and persist
  const enrollInCourse = useCallback((courseId: string) => {
    setEnrolledCourses((prev) => {
      if (prev.includes(courseId)) {
        return prev;
      }
      const updated = [...prev, courseId];
      try {
        localStorage.setItem(ENROLLED_STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error("Failed to save enrolled courses to LocalStorage:", error);
      }
      return updated;
    });
  }, []);

  // Check if course is enrolled
  const isEnrolled = useCallback(
    (courseId: string) => enrolledCourses.includes(courseId),
    [enrolledCourses]
  );

  // Calculate course completion metrics
  const getCourseProgress = useCallback(
    (course: Course) => {
      const items = getAllCourseItems(course);
      const totalCount = items.length;
      if (totalCount === 0) {
        return { completedCount: 0, totalCount: 0, percent: 0, isCompleted: false };
      }
      const completedCount = items.filter((item) =>
        completedLessons.includes(item.id)
      ).length;
      const percent = Math.round((completedCount / totalCount) * 100);
      const isCompleted = completedCount === totalCount;
      return { completedCount, totalCount, percent, isCompleted };
    },
    [completedLessons]
  );

  return {
    completedLessons,
    enrolledCourses,
    markLessonComplete,
    enrollInCourse,
    isEnrolled,
    getCourseProgress,
    isLoaded,
  };
}
