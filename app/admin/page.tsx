// app/admin/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { collection, doc, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FiPlus,
  FiSettings,
  FiDollarSign,
  FiTool,
  FiTrendingUp,
  FiList,
  FiHome,
  FiPieChart,
  FiUsers,
  FiCalendar,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiBarChart2,
  FiCreditCard,
} from "react-icons/fi";
import MonthlyPaymentModal from "@/components/modals/MonthlyPaymentModal";
import NewMaintenanceModal from "@/components/modals/NewMaintenanceModal";
import MaintenancePaymentModal from "@/components/modals/MaintenancePaymentModal";
import ExpenseModal from "@/components/modals/ExpenseModal";
import ManageMaintenanceModal from "@/components/modals/ManageMaintenanceModal";
import ManagePaymentsModal from "@/components/modals/ManagePaymentsModal";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ar } from "date-fns/locale";

type ModalType =
  | "monthly-payment"
  | "new-maintenance"
  | "maintenance-payment"
  | "expense"
  | "manage-maintenance"
  | "manage-payments"
  | null;

interface MaintenanceEvent {
  id: string;
  eventName_ar: string;
  description: string;
  totalCost: number;
  costPerFloor: number;
  date: string;
  status: "open" | "closed";
  collectedAmount?: number;
}

interface Floor {
  id: string;
  floorNumber: number;
}

interface FinancialData {
  totalBalance: number;
  monthlyRequired: number;
  monthlyCollected: number;
  totalExpenses: number;
  pendingPayments: number;
}

interface Payment {
  id: string;
  amountPaid: number;
  paymentDate: string;
  type: "monthly" | "event";
  floorId?: string;
  eventId?: string;
}

interface Expense {
  id: string;
  amount: number;
  description: string;
  date: string;
  type: "monthly" | "event";
  eventId?: string;
}

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<"overview" | "maintenance" | "financial">("overview");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalBalance: 0,
    monthlyRequired: 0,
    monthlyCollected: 0,
    totalExpenses: 0,
    pendingPayments: 0,
  });
  const [maintenanceEvents, setMaintenanceEvents] = useState<MaintenanceEvent[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [loading, setLoading] = useState(true);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [floorPaymentStatus, setFloorPaymentStatus] = useState<{
    monthly: { [floorId: string]: boolean };
    events: { [eventId: string]: { [floorId: string]: boolean } };
  }>({
    monthly: {},
    events: {},
  });
  const [selectedEventForPayments, setSelectedEventForPayments] = useState<string>("");

  // Set up real-time listeners
  useEffect(() => {
    const unsubscribeFunctions: (() => void)[] = [];

    // Listen to system data
    const balanceUnsubscribe = onSnapshot(doc(db, "system", "balance"), (doc) => {
      setFinancialData((prev) => ({
        ...prev,
        totalBalance: doc.data()?.totalBalance || 0,
      }));
    });

    const monthlyDueUnsubscribe = onSnapshot(doc(db, "system", "monthlyDuePayment"), (doc) => {
      setFinancialData((prev) => ({
        ...prev,
        monthlyRequired: doc.data()?.required || 0,
      }));
    });

    // Listen to floors
    const floorsUnsubscribe = onSnapshot(collection(db, "floors"), (snapshot) => {
      const floorsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Floor[];

      floorsData.sort((a, b) => a.floorNumber - b.floorNumber);
      setFloors(floorsData);
    });

    // Listen to events
    const eventsUnsubscribe = onSnapshot(collection(db, "events"), (snapshot) => {
      const eventsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as MaintenanceEvent[];
      setMaintenanceEvents(eventsData);
    });

    // Listen to monthly payments and calculate collected amount
    const monthlyPaymentsUnsubscribe = onSnapshot(collection(db, "monthlyPayments"), (snapshot) => {
      const monthlyCollected = snapshot.docs.reduce(
        (sum, doc) => sum + (doc.data().amountPaid || 0),
        0
      );

      setFinancialData((prev) => ({
        ...prev,
        monthlyCollected,
      }));

      // Update recent payments
      const monthlyPayments: Payment[] = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            type: "monthly",
          } as Payment)
      );

      setRecentPayments((prev) => {
        const eventPayments = prev.filter((p) => p.type === "event");
        const allPayments = [...monthlyPayments, ...eventPayments]
          .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
          .slice(0, 5);
        return allPayments;
      });
    });

    // Listen to event payments
    const eventPaymentsUnsubscribe = onSnapshot(collection(db, "eventPayments"), (snapshot) => {
      const eventPayments: Payment[] = snapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
            type: "event",
          } as Payment)
      );

      setRecentPayments((prev) => {
        const monthlyPayments = prev.filter((p) => p.type === "monthly");
        const allPayments = [...monthlyPayments, ...eventPayments]
          .sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime())
          .slice(0, 5);
        return allPayments;
      });

      // Update maintenance events with collected amounts
      setMaintenanceEvents((prev) =>
        prev.map((event) => {
          const eventCollected = snapshot.docs
            .filter((paymentDoc) => paymentDoc.data().eventId === event.id)
            .reduce((sum, paymentDoc) => sum + (paymentDoc.data().amountPaid || 0), 0);

          return {
            ...event,
            collectedAmount: eventCollected,
          };
        })
      );
    });

    // Listen to expenses
    const expensesUnsubscribe = onSnapshot(collection(db, "expenses"), (snapshot) => {
      const totalExpenses = snapshot.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

      setFinancialData((prev) => ({
        ...prev,
        totalExpenses,
      }));

      // Update recent expenses
      const expensesData: Expense[] = snapshot.docs
        .map(
          (doc) =>
            ({
              id: doc.id,
              ...doc.data(),
            } as Expense)
        )
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5);

      setRecentExpenses(expensesData);
    });

    // Collect all unsubscribe functions
    unsubscribeFunctions.push(
      balanceUnsubscribe,
      monthlyDueUnsubscribe,
      floorsUnsubscribe,
      eventsUnsubscribe,
      monthlyPaymentsUnsubscribe,
      eventPaymentsUnsubscribe,
      expensesUnsubscribe
    );

    // Set loading to false after initial setup
    const timer = setTimeout(() => setLoading(false), 1000);

    // Cleanup function
    return () => {
      unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
      clearTimeout(timer);
    };
  }, []);

  // Calculate pending payments whenever relevant data changes
  useEffect(() => {
    const pendingPayments = Math.max(
      0,
      financialData.monthlyRequired * floors.length - financialData.monthlyCollected
    );
    setFinancialData((prev) => ({
      ...prev,
      pendingPayments,
    }));
  }, [financialData.monthlyRequired, financialData.monthlyCollected, floors.length]);

  const actionButtons = [
    {
      id: "monthly-payment" as const,
      title: "إضافة دفعة شهرية",
      description: "تسجيل دفعة شهرية جديدة من الملاك",
      icon: FiDollarSign,
      color: "from-green-500 to-emerald-600",
      stats: `${financialData.monthlyCollected.toLocaleString("ar-EG")} ج.م مجمع`,
    },
    {
      id: "new-maintenance" as const,
      title: "حدث صيانة جديد",
      description: "إنشاء حدث صيانة جديد للعمارة",
      icon: FiTool,
      color: "from-blue-500 to-cyan-600",
      stats: `${maintenanceEvents.filter((e) => e.status === "open").length} أحداث نشطة`,
    },
    {
      id: "maintenance-payment" as const,
      title: "دفعة صيانة",
      description: "تسجيل دفعة صيانة من الملاك",
      icon: FiTrendingUp,
      color: "from-purple-500 to-indigo-600",
      stats: `${maintenanceEvents
        .reduce((sum, event) => sum + (event.collectedAmount || 0), 0)
        .toLocaleString("ar-EG")} ج.م مجمع`,
    },
    {
      id: "expense" as const,
      title: "إضافة مصروف",
      description: "تسجيل مصروف جديد للعمارة",
      icon: FiPlus,
      color: "from-orange-500 to-red-600",
      stats: `${financialData.totalExpenses.toLocaleString("ar-EG")} ج.م إجمالي المصروفات`,
    },
    {
      id: "manage-maintenance" as const,
      title: "إدارة الأحداث",
      description: "إدارة وتعديل أحداث الصيانة",
      icon: FiSettings,
      color: "from-gray-600 to-gray-800",
      stats: `${maintenanceEvents.length} حدث إجمالي`,
    },
    {
      id: "manage-payments" as const,
      title: "إدارة الدفعات",
      description: "إدارة جميع عمليات الدفع",
      icon: FiCreditCard,
      color: "from-yellow-600 to-orange-600",
      stats: `${recentPayments.length} دفعة حديثة`,
    },
  ];

  const handleActionClick = (actionId: ModalType) => {
    setModalType(actionId);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setModalType(null);
    // No need to reload data - real-time listeners will handle updates
  };
  // Add this function
  const calculatePaymentStatus = useCallback(async () => {
    const monthlyStatus: { [floorId: string]: boolean } = {};
    const eventStatus: { [eventId: string]: { [floorId: string]: boolean } } = {};

    // Format selected month to "YYYY-MM"
    const monthString = selectedMonth.toISOString().slice(0, 7);

    // Check monthly payments for selected month
    const monthlyPaymentsQuery = query(
      collection(db, "monthlyPayments"),
      where("month", "==", monthString)
    );
    const monthlySnapshot = await getDocs(monthlyPaymentsQuery);

    monthlySnapshot.docs.forEach((doc) => {
      const data = doc.data();
      monthlyStatus[data.floorId] = true;
    });

    // Check event payments for each open event
    const openEvents = maintenanceEvents.filter((event) => event.status === "open");
    for (const event of openEvents) {
      eventStatus[event.id] = {};

      const eventPaymentsQuery = query(
        collection(db, "eventPayments"),
        where("eventId", "==", event.id)
      );
      const eventSnapshot = await getDocs(eventPaymentsQuery);

      eventSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        eventStatus[event.id][data.floorId] = true;
      });
    }

    setFloorPaymentStatus({
      monthly: monthlyStatus,
      events: eventStatus,
    });
  }, [selectedMonth, maintenanceEvents]);

  useEffect(() => {
    calculatePaymentStatus();
  }, [calculatePaymentStatus]);

  const selectedEventData = maintenanceEvents.find((event) => event.id === selectedEvent);

  const renderModal = () => {
    switch (modalType) {
      case "monthly-payment":
        return <MonthlyPaymentModal isOpen={isModalOpen} onClose={closeModal} />;
      case "new-maintenance":
        return <NewMaintenanceModal isOpen={isModalOpen} onClose={closeModal} />;
      case "maintenance-payment":
        return <MaintenancePaymentModal isOpen={isModalOpen} onClose={closeModal} />;
      case "expense":
        return <ExpenseModal isOpen={isModalOpen} onClose={closeModal} />;
      case "manage-maintenance":
        return <ManageMaintenanceModal isOpen={isModalOpen} onClose={closeModal} />;
      case "manage-payments":
        return <ManagePaymentsModal isOpen={isModalOpen} onClose={closeModal} />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: "open" | "closed") => {
    const config = {
      open: { color: "bg-green-100 text-green-800 border-green-200", text: "نشط" },
      closed: { color: "bg-gray-100 text-gray-800 border-gray-200", text: "مغلق" },
    };
    return config[status];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="bg-linear-to-r from-blue-600 to-cyan-600 p-2 rounded-lg">
                <FiHome className="text-white text-xl" />
              </div>
              <div className="mr-3">
                <h1 className="text-xl font-bold text-gray-900">لوحة التحكم</h1>
                <p className="text-sm text-gray-600">اتحاد ملاك برج اليسر</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-sm text-gray-500">آخر تحديث</p>
              <p className="text-sm font-medium text-gray-900">
                {new Date().toLocaleDateString("ar-EG")}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Tabs Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <nav className="flex">
            {[
              { id: "overview", name: "نظرة عامة", icon: FiBarChart2 },
              { id: "maintenance", name: "أحداث الصيانة", icon: FiTool },
              { id: "financial", name: "التقارير المالية", icon: FiPieChart },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-4 px-1 text-center border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-600 bg-blue-50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <tab.icon className="inline ml-2" />
                {tab.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Financial Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Total Balance */}
              <div className="bg-linear-to-r from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-100 text-sm">الرصيد الإجمالي</p>
                    <p className="text-2xl font-bold mt-2">
                      {financialData.totalBalance.toLocaleString("ar-EG")} ج.م
                    </p>
                  </div>
                  <FiPieChart className="text-2xl opacity-90" />
                </div>
                <div className="mt-4 text-green-100 text-sm">
                  {financialData.totalExpenses > 0 && (
                    <span>
                      شامل المصروفات: {financialData.totalExpenses.toLocaleString("ar-EG")} ج.م
                    </span>
                  )}
                </div>
              </div>

              {/* Monthly Payments */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">الاشتراكات الشهرية</h3>
                  <FiDollarSign className="text-blue-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المجموع:</span>
                    <span className="font-semibold text-green-600">
                      {financialData.monthlyCollected.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المطلوب:</span>
                    <span className="font-semibold text-blue-600">
                      {financialData.monthlyRequired.toLocaleString("ar-EG")} ج.م/طابق
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المتبقي:</span>
                    <span className="font-semibold text-orange-600">
                      {financialData.pendingPayments.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Maintenance Overview */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">أحداث الصيانة</h3>
                  <FiTool className="text-purple-600" />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">النشطة:</span>
                    <span className="font-semibold text-green-600">
                      {maintenanceEvents.filter((e) => e.status === "open").length} حدث
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المجموع:</span>
                    <span className="font-semibold text-blue-600">
                      {maintenanceEvents
                        .reduce((sum, e) => sum + (e.collectedAmount || 0), 0)
                        .toLocaleString("ar-EG")}{" "}
                      ج.م
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">الإجمالي:</span>
                    <span className="font-semibold text-purple-600">
                      {maintenanceEvents
                        .reduce((sum, e) => sum + e.totalCost, 0)
                        .toLocaleString("ar-EG")}{" "}
                      ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">إجراءات سريعة</h3>
                  <FiClock className="text-orange-600" />
                </div>
                <div className="space-y-3">
                  <button
                    onClick={() => handleActionClick("monthly-payment")}
                    className="w-full text-right p-3 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                  >
                    <div className="font-medium text-green-800">تسجيل دفعة شهرية</div>
                  </button>
                  <button
                    onClick={() => handleActionClick("expense")}
                    className="w-full text-right p-3 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                  >
                    <div className="font-medium text-red-800">إضافة مصروف</div>
                  </button>
                  <button
                    onClick={() => handleActionClick("manage-payments")}
                    className="w-full text-right p-3 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
                  >
                    <div className="font-medium text-blue-800">مراجعة الدفعات</div>
                  </button>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Payments */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">آخر الدفعات</h3>
                <div className="space-y-3">
                  {recentPayments.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">لا توجد دفعات حديثة</p>
                  ) : (
                    recentPayments.map((payment) => (
                      <div
                        key={payment.id}
                        className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                      >
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            {payment.amountPaid.toLocaleString("ar-EG")} ج.م
                          </div>
                          <div className="text-sm text-gray-500">
                            {payment.type === "monthly" ? "دفعة شهرية" : "دفعة صيانة"}
                          </div>
                        </div>
                        <div className="text-left text-sm text-gray-500">
                          {new Date(payment.paymentDate).toLocaleDateString("ar-EG")}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Expenses */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">آخر المصروفات</h3>
                <div className="space-y-3">
                  {recentExpenses.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">لا توجد مصروفات حديثة</p>
                  ) : (
                    recentExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center justify-between p-3 border border-gray-100 rounded-lg"
                      >
                        <div className="text-right">
                          <div className="font-medium text-gray-900">
                            {expense.amount.toLocaleString("ar-EG")} ج.م
                          </div>
                          <div className="text-sm text-gray-500">{expense.description}</div>
                        </div>
                        <div className="text-left">
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              expense.type === "monthly"
                                ? "bg-green-100 text-green-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {expense.type === "monthly" ? "شهري" : "حدث"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {actionButtons.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleActionClick(action.id)}
                  className={`bg-linear-to-r ${action.color} rounded-2xl p-6 text-white shadow-lg hover:shadow-xl transition-all duration-200 transform hover:-translate-y-1 text-right`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <action.icon className="text-2xl opacity-90" />
                    <h3 className="text-lg font-semibold">{action.title}</h3>
                  </div>
                  <p className="text-white/90 text-sm mb-2 leading-relaxed">{action.description}</p>
                  <p className="text-white/70 text-xs">{action.stats}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className="space-y-6">
            {/* Maintenance Events Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-center">
                <FiCheckCircle className="text-green-600 text-2xl mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {maintenanceEvents.filter((e) => e.status === "open").length}
                </div>
                <div className="text-gray-600">أحداث نشطة</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-center">
                <FiDollarSign className="text-blue-600 text-2xl mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {maintenanceEvents
                    .reduce((sum, e) => sum + (e.collectedAmount || 0), 0)
                    .toLocaleString("ar-EG")}{" "}
                  ج.م
                </div>
                <div className="text-gray-600">المجموع</div>
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 text-center">
                <FiAlertTriangle className="text-orange-600 text-2xl mx-auto mb-2" />
                <div className="text-2xl font-bold text-gray-900">
                  {maintenanceEvents
                    .reduce(
                      (sum, e) => sum + Math.max(0, e.totalCost - (e.collectedAmount || 0)),
                      0
                    )
                    .toLocaleString("ar-EG")}{" "}
                  ج.م
                </div>
                <div className="text-gray-600">المتبقي</div>
              </div>
            </div>

            {/* Events List */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900">أحداث الصيانة</h3>
                <button
                  onClick={() => handleActionClick("new-maintenance")}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FiPlus className="inline ml-2" />
                  حدث جديد
                </button>
              </div>

              <div className="space-y-4">
                {maintenanceEvents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FiTool className="text-4xl mx-auto mb-4 text-gray-400" />
                    <p>لا توجد أحداث صيانة</p>
                    <button
                      onClick={() => handleActionClick("new-maintenance")}
                      className="mt-4 text-blue-600 hover:text-blue-700"
                    >
                      إنشاء أول حدث صيانة
                    </button>
                  </div>
                ) : (
                  maintenanceEvents.map((event) => {
                    const progress = ((event.collectedAmount || 0) / event.totalCost) * 100;
                    const statusConfig = getStatusBadge(event.status);

                    return (
                      <div
                        key={event.id}
                        className={`border-2 rounded-xl p-5 transition-all duration-200 cursor-pointer ${
                          selectedEvent === event.id
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                        onClick={() => setSelectedEvent(event.id)}
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-3">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium border ${statusConfig.color}`}
                            >
                              {statusConfig.text}
                            </span>
                            <span className="text-sm text-gray-500">
                              {new Date(event.date).toLocaleDateString("ar-EG", {
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                          </div>
                        </div>
                        <h4 className="text-lg font-semibold text-gray-900 text-right flex-1 mr-3">
                          {event.eventName_ar}
                        </h4>
                        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                          {event.description}
                        </p>

                        {/* Progress Bar */}
                        <div className="mb-3">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>
                              المجموع: {(event.collectedAmount || 0).toLocaleString("ar-EG")} ج.م
                            </span>
                            <span>التكلفة: {event.totalCost.toLocaleString("ar-EG")} ج.م</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(100, progress)}%` }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 text-center mt-1">
                            {Math.min(100, Math.round(progress))}% مكتمل
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center bg-blue-50 rounded-lg p-3">
                            <div className="font-semibold text-blue-700">
                              {event.totalCost.toLocaleString("ar-EG")} ج.م
                            </div>
                            <div className="text-blue-600 text-xs">التكلفة الإجمالية</div>
                          </div>
                          <div className="text-center bg-green-50 rounded-lg p-3">
                            <div className="font-semibold text-green-700">
                              {event.costPerFloor.toLocaleString("ar-EG")} ج.م
                            </div>
                            <div className="text-green-600 text-xs">لكل طابق</div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "financial" && (
          <div className="space-y-6">
            {/* Financial Reports */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Monthly Performance */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  أداء الاشتراكات الشهرية
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">إجمالي المطلوب:</span>
                    <span className="font-semibold">
                      {(financialData.monthlyRequired * floors.length).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المجموع:</span>
                    <span className="font-semibold text-green-600">
                      {financialData.monthlyCollected.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">نسبة التحصيل:</span>
                    <span className="font-semibold">
                      {floors.length > 0
                        ? Math.round(
                            (financialData.monthlyCollected /
                              (financialData.monthlyRequired * floors.length)) *
                              100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">تحليل المصروفات</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">إجمالي المصروفات:</span>
                    <span className="font-semibold text-red-600">
                      {financialData.totalExpenses.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  <div className="hidden justify-between items-center">
                    <span className="text-gray-600">صافي الدخل:</span>
                    <span className="font-semibold text-green-600">
                      {(
                        financialData.monthlyCollected - financialData.totalExpenses
                      ).toLocaleString("ar-EG")}{" "}
                      ج.م
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floor Payment Status */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 whitespace-nowrap">
                حالة الشهرية
              </h3>
              <DatePicker
                selected={selectedMonth}
                onChange={(date: Date | null) => date && setSelectedMonth(date)}
                dateFormat="MMMM yyyy"
                showMonthYearPicker
                locale={ar}
                className="px-3 py-2 border border-gray-300 rounded-lg text-right w-40"
                placeholderText="اختر الشهر"
              />
            </div>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">حالة دفع الطوابق</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {floors.map((floor) => {
                  const hasPaidMonthly = floorPaymentStatus.monthly[floor.id];
                  const floorName =
                    floor.floorNumber === 0 ? "الأرضي" : `الطابق ${floor.floorNumber}`;

                  return (
                    <div
                      key={floor.id}
                      className="text-center p-4 border border-gray-200 rounded-lg"
                    >
                      <div className="font-semibold text-gray-900">{floorName}</div>
                      <div className="text-sm text-gray-600 mt-2">
                        {financialData.monthlyRequired.toLocaleString("ar-EG")} ج.م
                      </div>
                      <div className="mt-2">
                        <span
                          className={`inline-block w-3 h-3 rounded-full ${
                            hasPaidMonthly ? "bg-green-500" : "bg-red-500"
                          }`}
                        ></span>
                        <span
                          className={`text-xs mr-1 ${
                            hasPaidMonthly ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {hasPaidMonthly ? "مسدد" : "غير مسدد"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {maintenanceEvents
              .filter((event) => event.status === "open")
              .map((event) => (
                <div
                  key={event.id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 mt-6"
                >
                  <div className="flex flex-col justify-center items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">حالة دفعات الأحداث</h4>
                    <select
                      value={selectedEventForPayments}
                      onChange={(e) => setSelectedEventForPayments(e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-right"
                    >
                      <option value="">اختر حدث لعرض الدفعات</option>
                      {maintenanceEvents
                        .filter((event) => event.status === "open")
                        .map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.eventName_ar} - {event.totalCost.toLocaleString("ar-EG")} ج.م
                          </option>
                        ))}
                    </select>
                  </div>
                  {selectedEventForPayments ? (
                    maintenanceEvents
                      .filter((event) => event.id === selectedEventForPayments)
                      .map((event) => (
                        <div key={event.id} className="mt-4">
                          <h5 className="font-semibold text-gray-800 mb-3">
                            {event.eventName_ar} - التكلفة:{" "}
                            {event.totalCost.toLocaleString("ar-EG")} ج.م
                          </h5>
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {floors.map((floor) => {
                              const hasPaidEvent = floorPaymentStatus.events[event.id]?.[floor.id];
                              const floorName =
                                floor.floorNumber === 0 ? "الأرضي" : `الطابق ${floor.floorNumber}`;

                              return (
                                <div
                                  key={floor.id}
                                  className="text-center p-4 border border-gray-200 rounded-lg"
                                >
                                  <div className="font-semibold text-gray-900">{floorName}</div>
                                  <div className="text-sm text-gray-600 mt-2">
                                    {event.costPerFloor.toLocaleString("ar-EG")} ج.م
                                  </div>
                                  <div className="mt-2">
                                    <span
                                      className={`inline-block w-3 h-3 rounded-full ${
                                        hasPaidEvent ? "bg-green-500" : "bg-red-500"
                                      }`}
                                    ></span>
                                    <span
                                      className={`text-xs mr-1 ${
                                        hasPaidEvent ? "text-green-600" : "text-red-600"
                                      }`}
                                    >
                                      {hasPaidEvent ? "مسدد" : "غير مسدد"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-gray-500 text-center py-4">
                      يرجى اختيار حدث لعرض حالة الدفعات
                    </p>
                  )}
                </div> // Close the main div
              ))}
          </div>
        )}
      </div>

      {/* Modal Renderer */}
      {renderModal()}
    </div>
  );
}
