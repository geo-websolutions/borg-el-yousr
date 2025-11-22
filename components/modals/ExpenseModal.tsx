// components/modals/ExpenseModal.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FiDollarSign,
  FiFileText,
  FiCheck,
  FiCreditCard,
  FiHome,
  FiTrendingUp,
  FiInfo,
} from "react-icons/fi";
import { Spinner } from "../LoadingSpinner";

interface ExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Event {
  id: string;
  eventName_ar: string;
  totalCost: number;
  collectedAmount?: number;
  status: "open" | "closed";
}

interface FinancialData {
  totalBalance: number;
  monthlyCollected: number;
  monthlyRequired: number;
}

export default function ExpenseModal({ isOpen, onClose }: ExpenseModalProps) {
  // State management for all modal data
  const [events, setEvents] = useState<Event[]>([]);
  const [financialData, setFinancialData] = useState<FinancialData>({
    totalBalance: 0,
    monthlyCollected: 0,
    monthlyRequired: 0,
  });
  const [expenseType, setExpenseType] = useState<"monthly" | "event">("monthly");
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"type" | "details" | "review">("type");

  // Load data when modal opens
  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  /**
   * Loads all necessary data from Firestore:
   * - Events with their payment data and status (only open events)
   * - System financial data (balance, monthly payments)
   * - Monthly payment requirements
   */
  const loadData = async () => {
    try {
      setLoading(true);

      // Load events with payment data and filter only open events
      const eventsSnapshot = await getDocs(collection(db, "events"));
      const eventPaymentsSnapshot = await getDocs(collection(db, "eventPayments"));

      const eventsData = eventsSnapshot.docs
        .map((doc) => {
          const eventData = doc.data();
          // Calculate collected amount for each event by summing all payments
          const eventPayments = eventPaymentsSnapshot.docs
            .filter((paymentDoc) => paymentDoc.data().eventId === doc.id)
            .reduce((sum, paymentDoc) => sum + (paymentDoc.data().amountPaid || 0), 0);

          return {
            id: doc.id,
            ...eventData,
            collectedAmount: eventPayments,
          } as Event;
        })
        // Only show events that are open (not closed)
        .filter((event) => event.status === "open");

      setEvents(eventsData);

      // Load financial data from system collections
      const balanceDoc = await getDoc(doc(db, "system", "balance"));
      const monthlyDueDoc = await getDoc(doc(db, "system", "monthlyDuePayment"));

      // Calculate total monthly collected from monthly payments
      const monthlyPaymentsSnapshot = await getDocs(collection(db, "monthlyPayments"));
      const monthlyCollected = monthlyPaymentsSnapshot.docs.reduce(
        (sum, doc) => sum + (doc.data().amountPaid || 0),
        0
      );

      setFinancialData({
        totalBalance: balanceDoc.data()?.totalBalance || 0,
        monthlyCollected: monthlyCollected,
        monthlyRequired: monthlyDueDoc.data()?.required || 0,
      });

      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("حدث خطأ في تحميل البيانات");
      setLoading(false);
    }
  };

  /**
   * Handles expense type selection and moves to details step
   */
  const handleTypeSelect = (type: "monthly" | "event") => {
    setExpenseType(type);
    setStep("details");
    setError("");
  };

  /**
   * Validates form details and moves to review step
   * Performs validation for:
   * - Required fields
   * - Valid amount
   * - Available funds (total balance)
   */
  const handleDetailsSubmit = () => {
    // Validate required fields
    if (!description.trim() || !amount) {
      setError("يرجى ملء جميع الحقول");
      return;
    }

    // Validate event selection for event expenses
    if (expenseType === "event" && !selectedEvent) {
      setError("يرجى اختيار حدث الصيانة");
      return;
    }

    // Validate amount is a positive number
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("يرجى إدخال مبلغ صحيح");
      return;
    }

    // Validate against total balance (both monthly and event expenses deduct from total balance)
    if (amountNum > financialData.totalBalance) {
      setError(
        `المبلغ يتجاوز الرصيد المتاح (${financialData.totalBalance.toLocaleString("ar-EG")} ج.م)`
      );
      return;
    }

    // All validations passed, move to review step
    setStep("review");
    setError("");
  };

  /**
   * Submits the expense to Firestore and updates system balance
   * Workflow:
   * 1. Add expense record to expenses collection with current timestamp
   * 2. Deduct amount from system total balance (for both monthly and event expenses)
   * 3. Reset form and close modal
   */
  const handleExpenseSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const amountNum = parseFloat(amount);

      // Step 1: Add expense record to Firestore with current date
      await addDoc(collection(db, "expenses"), {
        type: expenseType,
        eventId: expenseType === "event" ? selectedEvent : null,
        description: description.trim(),
        amount: amountNum,
        date: new Date().toISOString(), // Auto-assign current timestamp
        paidThrough: paymentMethod,
      });

      // Step 2: Update system balance (deduct expense amount from total balance for both types)
      const balanceDoc = await getDoc(doc(db, "system", "balance"));
      if (balanceDoc.exists()) {
        const currentBalance = balanceDoc.data().totalBalance || 0;
        await updateDoc(doc(db, "system", "balance"), {
          totalBalance: currentBalance - amountNum,
          lastUpdated: new Date().toISOString(),
        });
      }

      // Step 3: Reset form and close modal
      resetForm();
      setLoading(false);
      onClose();
    } catch (err) {
      console.error("Error adding expense:", err);
      setError("حدث خطأ في حفظ المصروف");
      setLoading(false);
    }
  };

  /**
   * Resets all form fields to their initial state
   */
  const resetForm = () => {
    setExpenseType("monthly");
    setSelectedEvent("");
    setDescription("");
    setAmount("");
    setPaymentMethod("cash");
    setStep("type");
  };

  // Don't render if modal is not open
  if (!isOpen) return null;

  // Show loading state while fetching data
  if (loading && step === "type") {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center p-4 z-50">
        <div className="bg-white flex flex-col items-center rounded-2xl p-8">
          <Spinner />
          <p className="text-gray-600 text-center mt-4">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[95vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 shrink-0">
          <h3 className="text-xl font-semibold text-gray-900">إضافة مصروف</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Progress Steps - Fixed */}
        <div className="flex p-6 pb-4 shrink-0">
          {["type", "details", "review"].map((stepName, index) => (
            <div
              key={stepName}
              className={`flex-1 text-center ${
                step === stepName ? "text-blue-600 font-medium" : "text-gray-500"
              }`}
            >
              <div
                className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                  step === stepName ? "bg-blue-600" : "bg-gray-300"
                }`}
              ></div>
              <span className="text-sm">
                {stepName === "type" ? "النوع" : stepName === "details" ? "التفاصيل" : "المراجعة"}
              </span>
            </div>
          ))}
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {/* STEP 1: Expense Type Selection */}
            {step === "type" && (
              <div className="space-y-6">
                <h4 className="text-lg font-medium text-gray-900 text-center">اختر نوع المصروف</h4>

                {/* Financial Overview */}
                <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">الرصيد الإجمالي:</span>
                    <span className="font-bold text-green-600 text-lg">
                      {financialData.totalBalance.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المجموع الشهري:</span>
                    <span className="font-medium text-blue-600">
                      {financialData.monthlyCollected.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المطلوب شهرياً:</span>
                    <span className="font-medium text-gray-700">
                      {financialData.monthlyRequired.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                </div>

                {/* Expense Type Selection - Bigger Buttons */}
                <div className="space-y-4">
                  {/* Monthly Expense Button */}
                  <button
                    onClick={() => handleTypeSelect("monthly")}
                    className={`w-full p-6 rounded-2xl border-3 transition-all duration-200 flex items-center justify-between ${
                      expenseType === "monthly"
                        ? "border-green-500 bg-green-50 text-green-700 shadow-lg scale-105"
                        : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center">
                      <FiHome className="text-2xl ml-4" />
                      <div className="text-right">
                        <div className="font-bold text-lg">مصروف شهري</div>
                        <div className="text-sm opacity-80">للمصاريف العامة للبناية</div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg">
                        {financialData.totalBalance.toLocaleString("ar-EG")} ج.م
                      </div>
                      <div className="text-sm opacity-80">متاح</div>
                    </div>
                  </button>

                  {/* Event Expense Button */}
                  <button
                    onClick={() => handleTypeSelect("event")}
                    className={`w-full p-6 rounded-2xl border-3 transition-all duration-200 flex items-center justify-between ${
                      expenseType === "event"
                        ? "border-blue-500 bg-blue-50 text-blue-700 shadow-lg scale-105"
                        : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center">
                      <FiTrendingUp className="text-2xl ml-4" />
                      <div className="text-right">
                        <div className="font-bold text-lg">مصروف حدث</div>
                        <div className="text-sm opacity-80">لمصاريف أحداث الصيانة</div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-lg">{events.length}</div>
                      <div className="text-sm opacity-80">حدث مفتوح</div>
                    </div>
                  </button>
                </div>

                {/* Information Note */}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div className="flex items-start">
                    <FiInfo className="text-blue-600 mt-1 ml-2" />
                    <div className="text-right">
                      <p className="text-blue-800 text-sm font-medium">معلومة هامة:</p>
                      <p className="text-blue-700 text-sm mt-1">
                        جميع المصاريف (شهرية وأحداث) تخصم من الرصيد الإجمالي للبناية.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Expense Details */}
            {step === "details" && (
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 text-center">
                  {expenseType === "monthly" ? "مصروف شهري" : "مصروف حدث"}
                </h4>

                {/* Financial Context Banner */}
                <div
                  className={`rounded-xl p-4 border-2 ${
                    expenseType === "monthly"
                      ? "bg-green-50 border-green-200"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">الرصيد المتاح:</span>
                    <span
                      className={`font-bold text-lg ${
                        expenseType === "monthly" ? "text-green-700" : "text-blue-700"
                      }`}
                    >
                      {financialData.totalBalance.toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  {expenseType === "monthly" && (
                    <div className="text-sm text-gray-600">
                      المجموع الشهري: {financialData.monthlyCollected.toLocaleString("ar-EG")} ج.م
                    </div>
                  )}
                </div>

                {/* Event Selection (only for event expenses) */}
                {expenseType === "event" && (
                  <div className="space-y-3">
                    <label className="block text-sm font-medium text-gray-700 text-right">
                      اختر حدث الصيانة
                    </label>
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {events.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <FiInfo className="text-2xl mx-auto mb-2 text-gray-400" />
                          <p>لا توجد أحداث صيانة مفتوحة حالياً</p>
                        </div>
                      ) : (
                        events.map((event) => {
                          return (
                            <button
                              key={event.id}
                              onClick={() => setSelectedEvent(event.id)}
                              className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-right ${
                                selectedEvent === event.id
                                  ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                                  : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-left">
                                  <div className="text-green-600 text-sm font-medium">نشط</div>
                                </div>
                                <h5 className="font-semibold text-lg flex-1 mr-2">
                                  {event.eventName_ar}
                                </h5>
                              </div>
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-gray-500">
                                  المجموع: {event.collectedAmount?.toLocaleString("ar-EG") || 0} ج.م
                                </span>
                                <span className="text-gray-500">
                                  التكلفة: {event.totalCost.toLocaleString("ar-EG")} ج.م
                                </span>
                              </div>
                              {selectedEvent === event.id && (
                                <FiCheck className="text-blue-600 mt-2 mx-auto" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="space-y-4">
                  {/* Description */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 text-right">
                      وصف المصروف
                    </label>
                    <div className="relative">
                      <FiFileText className="absolute left-3 top-3 text-gray-400" />
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="وصف تفاصيل المصروف"
                        rows={3}
                        className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right resize-none"
                      />
                    </div>
                  </div>

                  {/* Amount */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 text-right">
                      المبلغ
                    </label>
                    <div className="relative">
                      <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder={`أدخل المبلغ (الحد الأقصى: ${financialData.totalBalance.toLocaleString(
                          "ar-EG"
                        )} ج.م)`}
                        min="0"
                        max={financialData.totalBalance}
                        step="0.01"
                        className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                        dir="ltr"
                      />
                    </div>
                    {amount && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">سيبقى:</span>
                        <span className="font-medium text-green-600">
                          {Math.max(
                            0,
                            financialData.totalBalance - parseFloat(amount || "0")
                          ).toLocaleString("ar-EG")}{" "}
                          ج.م
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Payment Method - Bigger Buttons */}
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700 text-right">
                      طريقة الدفع
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => setPaymentMethod("cash")}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-center text-lg font-medium ${
                          paymentMethod === "cash"
                            ? "border-green-500 bg-green-50 text-green-700 shadow-md"
                            : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <FiDollarSign className="ml-3 text-xl" />
                        نقدي
                      </button>
                      <button
                        onClick={() => setPaymentMethod("bank")}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 flex items-center justify-center text-lg font-medium ${
                          paymentMethod === "bank"
                            ? "border-blue-500 bg-blue-50 text-blue-700 shadow-md"
                            : "border-gray-200 hover:border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <FiCreditCard className="ml-3 text-xl" />
                        بنكي
                      </button>
                    </div>
                  </div>
                </div>

                {/* Navigation Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setStep("type")}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium text-lg"
                  >
                    رجوع
                  </button>
                  <button
                    onClick={handleDetailsSubmit}
                    disabled={
                      !description || !amount || (expenseType === "event" && !selectedEvent)
                    }
                    className={`flex-1 py-3 px-4 rounded-xl font-medium text-lg transition-colors ${
                      description && amount && (expenseType === "monthly" || selectedEvent)
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "bg-gray-100 text-gray-400 cursor-not-allowed"
                    }`}
                  >
                    التالي
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Review and Confirmation */}
            {step === "review" && (
              <div className="space-y-4">
                <h4 className="text-lg font-medium text-gray-900 text-center">مراجعة البيانات</h4>

                {/* Review Summary */}
                <div className="space-y-3 bg-gray-50 rounded-xl p-4 border border-gray-200">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">نوع المصروف:</span>
                    <span className="font-medium text-gray-900">
                      {expenseType === "monthly" ? "مصروف شهري" : "مصروف حدث"}
                    </span>
                  </div>
                  {expenseType === "event" && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">الحدث:</span>
                      <span className="font-medium text-gray-900">
                        {events.find((e) => e.id === selectedEvent)?.eventName_ar}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-start">
                    <span className="text-gray-600">الوصف:</span>
                    <span className="font-medium text-gray-900 text-right flex-1 mr-2">
                      {description}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">المبلغ:</span>
                    <span className="font-bold text-red-600 text-lg">
                      {parseFloat(amount).toLocaleString("ar-EG")} ج.م
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">طريقة الدفع:</span>
                    <span className="font-medium text-gray-900">
                      {paymentMethod === "cash" ? "نقدي" : "بنكي"}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">التاريخ:</span>
                    <span className="font-medium text-gray-900">
                      {new Date().toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-600">الرصيد الجديد:</span>
                    <span className="font-bold text-green-600 text-lg">
                      {(financialData.totalBalance - parseFloat(amount)).toLocaleString("ar-EG")}{" "}
                      ج.م
                    </span>
                  </div>
                </div>

                {/* Final Navigation Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setStep("details")}
                    disabled={loading}
                    className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium text-lg"
                  >
                    رجوع
                  </button>
                  <button
                    onClick={handleExpenseSubmit}
                    disabled={loading}
                    className={`flex-1 py-3 px-4 rounded-xl font-medium text-lg transition-colors whitespace-nowrap ${
                      loading
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    {loading ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent ml-2"></div>
                        جاري الحفظ...
                      </div>
                    ) : (
                      <>
                        <FiCheck className="inline ml-2" />
                        تأكيد المصروف
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
