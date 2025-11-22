// components/modals/MaintenancePaymentModal.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FiHome, FiDollarSign, FiCheck, FiCalendar } from "react-icons/fi";
import { Spinner } from "../LoadingSpinner";

interface MaintenancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Floor {
  id: string;
  floorNumber: number;
}

interface Event {
  id: string;
  eventName_ar: string;
  totalCost: number;
  costPerFloor: number;
  status: string;
}

interface PaymentRecord {
  eventId: string;
  floorId: string;
  amountPaid: number;
  paymentDate: string;
  remainingAmount: number;
  isComplete: boolean;
}

export default function MaintenancePaymentModal({ isOpen, onClose }: MaintenancePaymentModalProps) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [selectedFloor, setSelectedFloor] = useState<string>("");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"select-event" | "select-floor" | "enter-payment">(
    "select-event"
  );
  const [existingPayments, setExistingPayments] = useState<PaymentRecord[]>([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load floors
      const floorsSnapshot = await getDocs(collection(db, "floors"));
      const floorsData = floorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Floor[];
      floorsData.sort((a, b) => a.floorNumber - b.floorNumber);
      setFloors(floorsData);

      // Load open events
      const eventsSnapshot = await getDocs(collection(db, "events"));
      const isEvent = (obj: any): obj is Event => {
        return obj && typeof obj.eventName_ar === "string" && typeof obj.status === "string";
      };
      const eventsData = eventsSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        .filter(isEvent)
        .filter((event) => event.status === "open");
      setEvents(eventsData);

      // Load existing payments
      const paymentsSnapshot = await getDocs(collection(db, "eventPayments"));
      const paymentsData = paymentsSnapshot.docs.map((doc) => ({
        ...doc.data(),
      })) as PaymentRecord[];
      setExistingPayments(paymentsData);

      setLoading(false);
    } catch (err) {
      console.error("Error loading data:", err);
      setError("حدث خطأ في تحميل البيانات");
      setLoading(false);
    }
  };

  const getFloorName = (floorNumber: number) => {
    if (floorNumber === 0) return "الطابق الأرضي";
    return `الطابق ${floorNumber}`;
  };

  const getRequiredAmount = (eventId: string, floorId: string): number => {
    const event = events.find((e) => e.id === eventId);
    if (!event) return 0;
    return event.costPerFloor;
  };

  const getRemainingAmount = (eventId: string, floorId: string): number => {
    const requiredAmount = getRequiredAmount(eventId, floorId);
    const existingPayment = existingPayments.find(
      (payment) => payment.eventId === eventId && payment.floorId === floorId
    );

    if (existingPayment) {
      return existingPayment.remainingAmount;
    }

    return requiredAmount;
  };

  const handleEventSelect = (eventId: string) => {
    setSelectedEvent(eventId);
    setError("");
  };

  const handleFloorSelect = (floorId: string) => {
    setSelectedFloor(floorId);
    setError("");
  };

  const proceedToFloorSelection = () => {
    if (!selectedEvent) {
      setError("يرجى اختيار حدث الصيانة");
      return;
    }
    setStep("select-floor");
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
    if (!selectedEvent || !selectedFloor || !paymentAmount) {
      setError("يرجى ملء جميع الحقول");
      return;
    }

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("يرجى إدخال مبلغ صحيح");
      return;
    }

    const remainingAmount = getRemainingAmount(selectedEvent, selectedFloor);
    if (amount > remainingAmount) {
      setError(
        `المبلغ المدخل أكبر من المبلغ المطلوب (${remainingAmount.toLocaleString("ar-EG")} ج.م)`
      );
      return;
    }

    setLoading(true);
    setError("");

    try {
      const newRemainingAmount = remainingAmount - amount;
      const isComplete = newRemainingAmount <= 0;

      // Add payment record
      await addDoc(collection(db, "eventPayments"), {
        eventId: selectedEvent,
        floorId: selectedFloor,
        amountPaid: amount,
        paymentDate: new Date().toISOString(),
        remainingAmount: newRemainingAmount,
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
      setSelectedEvent("");
      setSelectedFloor("");
      setPaymentAmount("");
      setStep("select-event");
      setLoading(false);
      onClose();
    } catch (err) {
      console.error("Error adding payment:", err);
      setError("حدث خطأ في حفظ الدفعة");
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  if (loading && step === "select-event") {
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
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">دفعة صيانة</h3>
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
              step === "select-event" ? "text-blue-600 font-medium" : "text-gray-500"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                step === "select-event" ? "bg-blue-600" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-sm">الحدث</span>
          </div>
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
            <span className="text-sm">الطابق</span>
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
            <span className="text-sm">الدفعة</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {step === "select-event" && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 text-center">اختر حدث الصيانة</h4>

              <div className="space-y-3 max-h-60 overflow-y-auto">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => handleEventSelect(event.id)}
                    className={`w-full p-4 rounded-xl border-2 transition-all duration-200 text-right ${
                      selectedEvent === event.id
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-700"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {event.costPerFloor.toLocaleString("ar-EG")} ج.م/طابق
                      </span>
                      <h5 className="font-semibold text-lg">{event.eventName_ar}</h5>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">
                        الإجمالي: {event.totalCost.toLocaleString("ar-EG")} ج.م
                      </span>
                      {selectedEvent === event.id && <FiCheck className="text-blue-600" />}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={proceedToFloorSelection}
                disabled={!selectedEvent}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
                  selectedEvent
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                التالي
              </button>
            </div>
          )}

          {step === "select-floor" && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 text-center">اختر الطابق</h4>

              {/* Selected Event Display */}
              <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-200">
                <span className="text-blue-700 font-medium">
                  {events.find((e) => e.id === selectedEvent)?.eventName_ar}
                </span>
                <p className="text-blue-600 text-sm mt-1">
                  المطلوب لكل طابق: {getRequiredAmount(selectedEvent, "").toLocaleString("ar-EG")}{" "}
                  ج.م
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                {floors.map((floor) => {
                  const remaining = getRemainingAmount(selectedEvent, floor.id);
                  const isPaid = remaining <= 0;

                  return (
                    <button
                      key={floor.id}
                      onClick={() => handleFloorSelect(floor.id)}
                      disabled={isPaid}
                      className={`p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center justify-center ${
                        selectedFloor === floor.id
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : isPaid
                          ? "border-green-200 bg-green-50 text-green-600 cursor-not-allowed"
                          : "border-gray-200 hover:border-gray-300 text-gray-700"
                      }`}
                    >
                      <FiHome
                        className={`text-xl mb-2 ${
                          selectedFloor === floor.id
                            ? "text-blue-600"
                            : isPaid
                            ? "text-green-500"
                            : "text-gray-400"
                        }`}
                      />
                      <span className="font-medium">{getFloorName(floor.floorNumber)}</span>
                      <span className="text-xs mt-1">
                        {isPaid ? "مكتمل" : `${remaining.toLocaleString("ar-EG")} ج.م`}
                      </span>
                      {selectedFloor === floor.id && <FiCheck className="text-blue-600 mt-1" />}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep("select-event")}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  رجوع
                </button>
                <button
                  onClick={proceedToPayment}
                  disabled={!selectedFloor}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                    selectedFloor
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  التالي
                </button>
              </div>
            </div>
          )}

          {step === "enter-payment" && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 text-center">إدخال بيانات الدفعة</h4>

              {/* Summary */}
              <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">الحدث:</span>
                  <span className="font-medium text-gray-900">
                    {events.find((e) => e.id === selectedEvent)?.eventName_ar}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">الطابق:</span>
                  <span className="font-medium text-gray-900">
                    {getFloorName(floors.find((f) => f.id === selectedFloor)?.floorNumber || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">المطلوب:</span>
                  <span className="font-medium text-blue-600">
                    {getRequiredAmount(selectedEvent, selectedFloor).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">المتبقي:</span>
                  <span className="font-medium text-orange-600">
                    {getRemainingAmount(selectedEvent, selectedFloor).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-right">
                  المبلغ المدفوع
                </label>
                <div className="relative">
                  <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder={`أدخل المبلغ حتى ${getRemainingAmount(
                      selectedEvent,
                      selectedFloor
                    ).toLocaleString("ar-EG")}`}
                    min="0"
                    max={getRemainingAmount(selectedEvent, selectedFloor)}
                    step="0.01"
                    className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    dir="ltr"
                  />
                </div>
                {paymentAmount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">سيبقى:</span>
                    <span className="font-medium text-green-600">
                      {Math.max(
                        0,
                        getRemainingAmount(selectedEvent, selectedFloor) -
                          parseFloat(paymentAmount || "0")
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
                  disabled={loading || !paymentAmount}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors ${
                    loading || !paymentAmount
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
