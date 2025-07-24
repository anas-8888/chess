import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Home, 
  BookOpen, 
  Play, 
  Clock, 
  Star, 
  ChevronRight,
  Trophy,
  Target,
  Zap,
  Crown,
  Users,
  CheckCircle2
} from "lucide-react";

interface Course {
  id: string;
  title: string;
  description: string;
  level: "مبتدئ" | "متوسط" | "متقدم";
  duration: number; // in minutes
  lessons: number;
  rating: number;
  enrolled: number;
  progress?: number;
  thumbnail: string;
  category: "مقدمة" | "افتتاحيات" | "تكتيكات" | "إستراتيجيا" | "النهايات";
  instructor: string;
  isEnrolled?: boolean;
}

interface Lesson {
  id: string;
  title: string;
  duration: number;
  type: "video" | "interactive" | "quiz";
  completed?: boolean;
}

const Courses = () => {
  const { toast } = useToast();
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const courses: Course[] = [
    {
      id: "intro-basics",
      title: "أساسيات الشطرنج للمبتدئين",
      description: "تعلم قواعد الشطرنج الأساسية وحركات القطع",
      level: "مبتدئ",
      duration: 120,
      lessons: 8,
      rating: 4.8,
      enrolled: 1234,
      progress: 75,
      thumbnail: "photo-1581090464777-f3220bbe1b8b",
      category: "مقدمة",
      instructor: "أستاذ محمد أحمد",
      isEnrolled: true
    },
    {
      id: "openings-guide",
      title: "دليل الافتتاحيات الكلاسيكية",
      description: "تعلم أهم الافتتاحيات وأساسياتها",
      level: "متوسط",
      duration: 180,
      lessons: 12,
      rating: 4.7,
      enrolled: 856,
      progress: 30,
      thumbnail: "photo-1473091534298-04dcbce3278c",
      category: "افتتاحيات",
      instructor: "أستاذة سارة محمود",
      isEnrolled: true
    },
    {
      id: "tactics-mastery",
      title: "إتقان التكتيكات المتقدمة",
      description: "تحسين قدراتك التكتيكية بتمارين متدرجة",
      level: "متقدم",
      duration: 240,
      lessons: 15,
      rating: 4.9,
      enrolled: 642,
      thumbnail: "photo-1582562124811-c09040d0a901",
      category: "تكتيكات",
      instructor: "أستاذ أحمد علي"
    },
    {
      id: "endgame-theory",
      title: "نظريات النهايات الأساسية",
      description: "فهم النهايات المهمة وتقنيات الفوز",
      level: "متوسط",
      duration: 160,
      lessons: 10,
      rating: 4.6,
      enrolled: 723,
      thumbnail: "photo-1441057206919-63d19fac2369",
      category: "النهايات",
      instructor: "أستاذ خالد حسن"
    }
  ];

  const courseLessons: Lesson[] = [
    { id: "1", title: "مقدمة عن لعبة الشطرنج", duration: 15, type: "video", completed: true },
    { id: "2", title: "تعلم حركات القطع", duration: 20, type: "interactive", completed: true },
    { id: "3", title: "قواعد اللعب الأساسية", duration: 18, type: "video", completed: true },
    { id: "4", title: "تمارين على الحركات", duration: 25, type: "quiz", completed: false },
    { id: "5", title: "الكش والكش مات", duration: 22, type: "video", completed: false },
  ];

  const categories = [
    { id: "all", name: "جميع الدورات", icon: BookOpen },
    { id: "مقدمة", name: "المقدمة", icon: Star },
    { id: "افتتاحيات", name: "الافتتاحيات", icon: Zap },
    { id: "تكتيكات", name: "التكتيكات", icon: Target },
    { id: "إستراتيجيا", name: "الإستراتيجيا", icon: Crown },
    { id: "النهايات", name: "النهايات", icon: Trophy }
  ];

  const filteredCourses = selectedCategory === "all" 
    ? courses 
    : courses.filter(course => course.category === selectedCategory);

  const enrollInCourse = (courseId: string) => {
    // REST: POST /api/courses/${courseId}/enroll
    toast({
      title: "تم التسجيل بنجاح!",
      description: "يمكنك الآن بدء الدورة والوصول لجميع الدروس"
    });
  };

  const startLesson = (lessonId: string) => {
    // REST: POST /api/lessons/${lessonId}/start
    toast({
      title: "بدء الدرس",
      description: "سيتم فتح الدرس في نافذة جديدة"
    });
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "مبتدئ": return "text-green-600 bg-green-100";
      case "متوسط": return "text-yellow-600 bg-yellow-100";
      case "متقدم": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getLessonIcon = (type: string) => {
    switch (type) {
      case "video": return <Play className="h-4 w-4" />;
      case "interactive": return <Target className="h-4 w-4" />;
      case "quiz": return <CheckCircle2 className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-subtle" dir="rtl">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="icon">
                  <Home className="h-5 w-5" />
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-bold text-foreground font-cairo">الدورات التعليمية</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">3,456 طالب مسجل</span>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {selectedCourse ? (
          /* Course Details View */
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Button
                onClick={() => setSelectedCourse(null)}
                variant="ghost"
                className="mb-4"
              >
                <ChevronRight className="ml-2 h-4 w-4 rotate-180" />
                العودة للدورات
              </Button>
              
              <div className="grid lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  {/* Course Header */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2">
                            <Badge className={getLevelColor(selectedCourse.level)}>
                              {selectedCourse.level}
                            </Badge>
                            <h1 className="text-2xl font-bold font-cairo">{selectedCourse.title}</h1>
                            <p className="text-muted-foreground">{selectedCourse.description}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{selectedCourse.duration} دقيقة</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <BookOpen className="h-4 w-4" />
                            <span>{selectedCourse.lessons} درس</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-4 w-4 text-yellow-500" />
                            <span>{selectedCourse.rating}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{selectedCourse.enrolled} طالب</span>
                          </div>
                        </div>

                        {selectedCourse.isEnrolled && selectedCourse.progress && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span>التقدم في الدورة</span>
                              <span>{selectedCourse.progress}%</span>
                            </div>
                            <Progress value={selectedCourse.progress} className="h-2" />
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Video Placeholder */}
                  <Card>
                    <CardContent className="p-0">
                      <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                        <div className="text-center space-y-4">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                            <Play className="h-8 w-8 text-primary" />
                          </div>
                          <p className="text-muted-foreground">فيديو تعريفي بالدورة</p>
                          <Button variant="chess">
                            تشغيل المقدمة
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Course Content */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="font-cairo">محتوى الدورة</CardTitle>
                      <CardDescription>
                        {courseLessons.length} دروس • {selectedCourse.duration} دقيقة إجمالي
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {courseLessons.map((lesson, index) => (
                        <div key={lesson.id}>
                          <div 
                            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 cursor-pointer"
                            onClick={() => startLesson(lesson.id)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                lesson.completed ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'
                              }`}>
                                {lesson.completed ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  getLessonIcon(lesson.type)
                                )}
                              </div>
                              <div>
                                <div className="font-medium">{lesson.title}</div>
                                <div className="text-sm text-muted-foreground">
                                  {lesson.duration} دقيقة • {lesson.type === "video" ? "فيديو" : 
                                   lesson.type === "interactive" ? "تفاعلي" : "اختبار"}
                                </div>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          </div>
                          {index < courseLessons.length - 1 && <Separator />}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-6 space-y-4">
                      {selectedCourse.isEnrolled ? (
                        <Button variant="chess" className="w-full">
                          متابعة التعلم
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => enrollInCourse(selectedCourse.id)}
                          variant="chess" 
                          className="w-full"
                        >
                          التسجيل في الدورة
                        </Button>
                      )}
                      
                      <div className="text-center text-sm text-muted-foreground">
                        دورة مجانية • وصول مدى الحياة
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="font-cairo">المدرب</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{selectedCourse.instructor}</div>
                          <div className="text-sm text-muted-foreground">مدرب شطرنج معتمد</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Courses List View */
          <div className="space-y-8">
            {/* Categories */}
            <Card>
              <CardContent className="p-6">
                <div className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      variant={selectedCategory === category.id ? "default" : "ghost"}
                      size="sm"
                      className="gap-2"
                    >
                      <category.icon className="h-4 w-4" />
                      {category.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Courses Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <Card 
                  key={course.id}
                  className="cursor-pointer hover:shadow-card transition-all duration-300"
                  onClick={() => setSelectedCourse(course)}
                >
                  <CardContent className="p-0">
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted rounded-t-lg flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent rounded-t-lg" />
                      <Play className="h-12 w-12 text-white relative z-10" />
                      <Badge 
                        className={`absolute top-3 right-3 ${getLevelColor(course.level)}`}
                      >
                        {course.level}
                      </Badge>
                    </div>
                    
                    <div className="p-6 space-y-4">
                      <div>
                        <h3 className="font-semibold font-cairo line-clamp-2">{course.title}</h3>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {course.description}
                        </p>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{course.duration}د</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          <span>{course.lessons}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-yellow-500" />
                          <span>{course.rating}</span>
                        </div>
                      </div>

                      {course.isEnrolled && course.progress && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>التقدم</span>
                            <span>{course.progress}%</span>
                          </div>
                          <Progress value={course.progress} className="h-1" />
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">
                          {course.instructor}
                        </span>
                        {course.isEnrolled ? (
                          <Badge variant="outline" className="text-green-600 border-green-200">
                            مسجل
                          </Badge>
                        ) : (
                          <span className="text-sm font-medium text-primary">مجاني</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Courses;