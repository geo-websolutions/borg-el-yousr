// components/modals/NewMaintenanceModal.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FiTool, FiDollarSign, FiFileText, FiCheck } from "react-icons/fi";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ar } from "date-fns/locale";
import { Spinner } from "../LoadingSpinner";

interface NewMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Floor {
  id: string;
  floorNumber: number;
}

export default function NewMaintenanceModal({ isOpen, onClose }: NewMaintenanceModalProps) {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [eventName, setEventName] = useState("");
  const [description, setDescription] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"details" | "review">("details");

  useEffect(() => {
    if (isOpen) {
      loadFloors();
    }
  }, [isOpen]);

  const loadFloors = async () => {
    try {
      setLoading(true);
      const floorsSnapshot = await getDocs(collection(db, "floors"));
      const floorsData = floorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Floor[];

      floorsData.sort((a, b) => a.floorNumber - b.floorNumber);
      setFloors(floorsData);
      setLoading(false);
    } catch (err) {
      console.error("Error loading floors:", err);
      setError("حدث خطأ في تحميل بيانات الطوابق");
      setLoading(false);
    }
  };

  const calculateCostPerFloor = (total: number): number => {
    if (floors.length === 0) return 0;
    return Math.ceil(total / floors.length);
  };

  const handleDetailsSubmit = () => {
    if (!eventName.trim() || !description.trim() || !totalCost || !selectedDate) {
      setError("يرجى ملء جميع الحقول");
      return;
    }

    const cost = parseFloat(totalCost);
    if (isNaN(cost) || cost <= 0) {
      setError("يرجى إدخال مبلغ صحيح");
      return;
    }

    setStep("review");
    setError("");
  };

  const handleCreateEvent = async () => {
    setLoading(true);
    setError("");

    try {
      const cost = parseFloat(totalCost);
      const costPerFloor = calculateCostPerFloor(cost);

      await addDoc(collection(db, "events"), {
        eventName_ar: eventName.trim(),
        description: description.trim(),
        totalCost: cost,
        costPerFloor: costPerFloor,
        date: selectedDate?.toISOString(),
        status: "open",
      });

      // Reset form and close
      setEventName("");
      setDescription("");
      setTotalCost("");
      setSelectedDate(new Date());
      setStep("details");
      setLoading(false);
      onClose();
    } catch (err) {
      console.error("Error creating event:", err);
      setError("حدث خطأ في إنشاء حدث الصيانة");
      setLoading(false);
    }
  };

  const getFloorName = (floorNumber: number) => {
    if (floorNumber === 0) return "الطابق الأرضي";
    return `الطابق ${floorNumber}`;
  };

  if (!isOpen) return null;

  if (loading) {
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
          <h3 className="text-xl font-semibold text-gray-900">حدث صيانة جديد</h3>
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
              step === "details" ? "text-blue-600 font-medium" : "text-gray-500"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                step === "details" ? "bg-blue-600" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-sm">تفاصيل الحدث</span>
          </div>
          <div
            className={`flex-1 text-center ${
              step === "review" ? "text-blue-600 font-medium" : "text-gray-500"
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full mx-auto mb-2 ${
                step === "review" ? "bg-blue-600" : "bg-gray-300"
              }`}
            ></div>
            <span className="text-sm">مراجعة</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {step === "details" && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 text-center">تفاصيل حدث الصيانة</h4>

              {/* Event Name */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-right">
                  اسم الحدث
                </label>
                <div className="relative">
                  <FiTool className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    placeholder="أدخل اسم حدث الصيانة"
                    className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-right">الوصف</label>
                <div className="relative">
                  <FiFileText className="absolute left-3 top-3 text-gray-400" />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="وصف تفاصيل الصيانة المطلوبة"
                    rows={3}
                    className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right resize-none"
                  />
                </div>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-right">
                  تاريخ الحدث
                </label>
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

              {/* Total Cost */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 text-right">
                  التكلفة الإجمالية
                </label>
                <div className="relative">
                  <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="number"
                    value={totalCost}
                    onChange={(e) => setTotalCost(e.target.value)}
                    placeholder="أدخل التكلفة الإجمالية"
                    min="0"
                    step="0.01"
                    className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    dir="ltr"
                  />
                </div>
                {totalCost && (
                  <p className="text-sm text-gray-600 text-center">
                    التكلفة لكل طابق:{" "}
                    <strong>
                      {calculateCostPerFloor(parseFloat(totalCost)).toLocaleString("ar-EG")} ج.م
                    </strong>
                  </p>
                )}
              </div>

              <button
                onClick={handleDetailsSubmit}
                disabled={!eventName || !description || !totalCost || !selectedDate}
                className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
                  eventName && description && totalCost && selectedDate
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
              >
                التالي
              </button>
            </div>
          )}

          {step === "review" && (
            <div className="space-y-4">
              <h4 className="text-lg font-medium text-gray-900 text-center">مراجعة البيانات</h4>

              <div className="space-y-3 bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">اسم الحدث:</span>
                  <span className="font-medium text-gray-900">{eventName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-gray-600">الوصف:</span>
                  <span className="font-medium text-gray-900 text-right flex-1 mr-2">
                    {description}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">التاريخ:</span>
                  <span className="font-medium text-gray-900">
                    {selectedDate?.toLocaleDateString("ar-EG", { year: "numeric", month: "long" })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">التكلفة الإجمالية:</span>
                  <span className="font-medium text-green-600">
                    {parseFloat(totalCost).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">التكلفة لكل طابق:</span>
                  <span className="font-medium text-blue-600">
                    {calculateCostPerFloor(parseFloat(totalCost)).toLocaleString("ar-EG")} ج.م
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">عدد الطوابق:</span>
                  <span className="font-medium text-gray-900">{floors.length} طوابق</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setStep("details")}
                  disabled={loading}
                  className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                >
                  رجوع
                </button>
                <button
                  onClick={handleCreateEvent}
                  disabled={loading}
                  className={`flex-1 py-3 px-4 rounded-xl font-medium transition-colors whitespace-nowrap ${
                    loading
                      ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                      : "bg-green-600 text-white hover:bg-green-700"
                  }`}
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent ml-2"></div>
                      جاري الإنشاء...
                    </div>
                  ) : (
                    <>
                      <FiCheck className="inline ml-2" />
                      إنشاء الحدث
                    </>
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
