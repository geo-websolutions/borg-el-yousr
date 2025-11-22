// components/modals/MonthlyPaymentModal.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, updateDoc, doc, getDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FiHome, FiCheck, FiCalendar } from "react-icons/fi";
import { FaPoundSign } from "react-icons/fa";
import { Spinner } from "../LoadingSpinner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ar } from "date-fns/locale";

interface MonthlyPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Floor {
  id: string;
  floorNumber: number;
  name: string;
}

interface SystemConfig {
  monthlyDuePayment: number;
}

export default function MonthlyPaymentModal({ isOpen, onClose }: MonthlyPaymentModalProps) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [monthlyDueAmount, setMonthlyDueAmount] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"select-floor" | "enter-payment">("select-floor");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadFloorsAndConfig();
    }
  }, [isOpen]);

  const loadFloorsAndConfig = async () => {
    try {
      setLoading(true);
      // Load floors
      const floorsSnapshot = await getDocs(collection(db, "floors"));
      const floorsData = floorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Floor[];

      // Sort floors by floor number
      floorsData.sort((a, b) => a.floorNumber - b.floorNumber);
      setFloors(floorsData);

      // Load monthly due amount
      const systemDoc = await getDoc(doc(db, "system", "monthlyDuePayment"));
      if (systemDoc.exists()) {
        setMonthlyDueAmount(systemDoc.data().required || 0);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("حدث خطأ في تحميل البيانات");
      setLoading(false);
    }
  };

  const handleFloorSelect = (floorId: string) => {
    setSelectedFloor(floorId);
    setError("");
  };

  const proceedToPayment = () => {
    if (!selectedFloor) {
      setError("يرجى اختيار الطابق");
      return;
    }
    setStep("enter-payment");
    setError("");
  };

  const handlePaymentSubmit = async () => {
    if (!selectedFloor || !paymentAmount || !selectedDate) {
      setError("يرجى ملء جميع الحقول");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("يرجى إدخال مبلغ صحيح");
      return;
    }

    if (amount > monthlyDueAmount) {
      setError(`المبلغ المدخل أكبر من المبلغ المطلوب (${monthlyDueAmount} ج.م)`);
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Calculate remaining amount
      const remainingAmount = monthlyDueAmount - amount;
      const isComplete = remainingAmount <= 0;
      const monthString = selectedDate
        ? `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`
        : "";
      // Add payment to monthlyPayments collection
      await addDoc(collection(db, "monthlyPayments"), {
        floorId: selectedFloor,
        month: monthString,
        amountPaid: amount,
        paymentDate: new Date().toISOString(),
        remainingAmount: remainingAmount,
        isComplete: isComplete,
      });

      // Update system balance
      const balanceDoc = await getDoc(doc(db, "system", "balance"));
      if (balanceDoc.exists()) {
        const currentBalance = balanceDoc.data().totalBalance || 0;
        await updateDoc(doc(db, "system", "balance"), {
          totalBalance: currentBalance + amount,
          lastUpdated: new Date().toISOString(),
        });
      }

      // Reset form and close
      setSelectedFloor("");
      setPaymentAmount("");
      setStep("select-floor");
      setLoading(false);
      onClose();
    } catch (err) {
      console.error("Error adding payment:", err);
      setError("حدث خطأ في حفظ الدفعة");
      setLoading(false);
    }
  };

  const getFloorName = (floorNumber: number) => {
    if (floorNumber === 0) return "الطابق الأرضي";
    return `الطابق ${floorNumber}`;
  };

  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString("ar-EG", { year: "numeric", month: "long" });
  };

  if (!isOpen) return null;

  if (loading && step === "select-floor") {
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
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">إضافة دفعة شهرية</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex p-6 pb-4">
          <div
            className={`flex-1 text-center ${
              step === "select-floor" ? "text-blue-600 font-medium" : "text-gray-500"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                step === "select-floor" ? "bg-blue-600" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-sm">اختيار الطابق</span>
          </div>
          <div
            className={`flex-1 text-center ${
              step === "enter-payment" ? "text-blue-600 font-medium" : "text-gray-500"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                step === "enter-payment" ? "bg-blue-600" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-sm">إدخال الدفعة</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {step === "select-floor" && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 text-center">اختر الطابق</h4>
              <p className="text-gray-600 text-center text-sm">
                المبلغ المطلوب شهرياً:{" "}
                <strong>{monthlyDueAmount.toLocaleString("ar-EG")} ج.م</strong>
              </p>

              <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {floors.map((floor) => (
                  <button
                    key={floor.id}
                    onClick={() => handleFloorSelect(floor.id)}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center ${
                      selectedFloor === floor.id
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <FiHome
                      className={`text-xl mb-2 ${
                        selectedFloor === floor.id ? "text-blue-600" : "text-gray-400"
                      }`}
                    />
                    <span className="font-medium">{getFloorName(floor.floorNumber)}</span>
                    {selectedFloor === floor.id && <FiCheck className="text-blue-600 mt-1" />}
                  </button>
                ))}
              </div>

              <button
                onClick={proceedToPayment}
                disabled={!selectedFloor}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
                  selectedFloor
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                التالي
              </button>
            </div>
          )}

          {step === "enter-payment" && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 text-center">إدخال بيانات الدفعة</h4>

              {/* Selected Floor Display */}
              <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
                <FiHome className="text-blue-600 text-xl mx-auto mb-2" />
                <span className="text-blue-700 font-medium">
                  {getFloorName(floors.find((f) => f.id === selectedFloor)?.floorNumber || 0)}
                </span>
              </div>

              {/* Month Selection */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-right">الشهر</label>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date: Date | null) => setSelectedDate(date)}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  locale={ar}
                  className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right"
                  placeholderText="اختر الشهر"
                />
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-right">
                  المبلغ المدفوع
                </label>
                <div className="relative">
                  <FaPoundSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`أدخل المبلغ حتى ${monthlyDueAmount.toLocaleString("ar-EG")}`}
                    min="0"
                    max={monthlyDueAmount}
                    step="0.01"
                    className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    dir="ltr"
                  />
                </div>
                {paymentAmount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">المتبقي:</span>
                    <span className="font-medium text-green-600">
                      {Math.max(
                        0,
                        monthlyDueAmount - parseFloat(paymentAmount || "0")
                      ).toLocaleString("ar-EG")}{" "}
                      ج.م
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep("select-floor")}
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  رجوع
                </button>
                <button
                  onClick={handlePaymentSubmit}
                  disabled={loading || !paymentAmount || !selectedDate}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                    loading || !paymentAmount || !selectedDate
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent ml-2"></div>
                      جاري الحفظ...
                    </div>
                  ) : (
                    "تأكيد الدفعة"
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
