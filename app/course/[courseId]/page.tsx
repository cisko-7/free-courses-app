import { courses } from "@/lib/data";
import { notFound } from "next/navigation";
import CourseViewer from "@/components/CourseViewer";
import type { Metadata } from "next";

// Required for Next.js SSG static export (output: 'export')
export async function generateStaticParams() {
  return courses.map((course) => ({
    courseId: course.id,
  }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ courseId: string }>;
}): Promise<Metadata> {
  const { courseId } = await params;
  const course = courses.find((c) => c.id === courseId);

  if (!course) {
    return {
      title: "Курс не найден — DevCourses",
    };
  }

  return {
    title: `${course.title} — DevCourses`,
    description: course.description,
  };
}

export default async function CoursePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const course = courses.find((c) => c.id === courseId);

  if (!course) {
    notFound();
  }

  return <CourseViewer course={course} />;
}
