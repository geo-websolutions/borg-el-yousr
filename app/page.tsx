// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { registerLocale } from "react-datepicker";
import { ar } from "date-fns/locale";
import { FiCheck, FiX, FiHome } from "react-icons/fi";

interface Floor {
  id: string;
  floorNumber: number;
}

interface PaymentStatus {
  floorId: string;
  floorName: string;
  hasPaid: boolean;
  amountPaid?: number;
  paymentDate?: string;
}

registerLocale("ar-SA", ar);

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [floors, setFloors] = useState<Floor[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [monthlyRequired, setMonthlyRequired] = useState(0);

  useEffect(() => {
    loadFloorsAndConfig();
  }, []);

  useEffect(() => {
    if (selectedDate) {
      loadPaymentStatus();
    }
  }, [selectedDate]);

  const loadFloorsAndConfig = async () => {
    try {
      // Load floors
      const floorsSnapshot = await getDocs(collection(db, "floors"));
      const floorsData = floorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Floor[];

      floorsData.sort((a, b) => a.floorNumber - b.floorNumber);
      setFloors(floorsData);

      // Load monthly required amount
      const monthlyDueDoc = await getDocs(collection(db, "system"));
      const monthlyDueData = monthlyDueDoc.docs.find((doc) => doc.id === "monthlyDuePayment");
      if (monthlyDueData) {
        setMonthlyRequired(monthlyDueData.data().required || 0);
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const loadPaymentStatus = async () => {
    if (!selectedDate) return;

    setLoading(true);
    try {
      const monthString = selectedDate.toISOString().slice(0, 7); // "2024-01" format

      // Query monthly payments for selected month
      const paymentsQuery = query(
        collection(db, "monthlyPayments"),
        where("month", "==", monthString)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      const paidFloors = new Set();
      const paymentData = new Map();

      paymentsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        paidFloors.add(data.floorId);
        paymentData.set(data.floorId, {
          amountPaid: data.amountPaid,
          paymentDate: data.paymentDate,
        });
      });

      // Create payment status array
      const statusData: PaymentStatus[] = floors.map((floor) => {
        const hasPaid = paidFloors.has(floor.id);
        const floorName = floor.floorNumber === 0 ? "الطابق الأرضي" : `الطابق ${floor.floorNumber}`;

        return {
          floorId: floor.id,
          floorName,
          hasPaid,
          ...(hasPaid && paymentData.get(floor.id)),
        };
      });

      setPaymentStatus(statusData);
    } catch (error) {
      console.error("Error loading payment status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (date: Date | null) => {
    setSelectedDate(date);
  };

  const getFloorName = (floorNumber: number) => {
    return floorNumber === 0 ? "الطابق الأرضي" : `الطابق ${floorNumber}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const totalPaid = paymentStatus.filter((item) => item.hasPaid).length;
  const totalFloors = floors.length;
  const paymentRate = totalFloors > 0 ? Math.round((totalPaid / totalFloors) * 100) : 0;

  return (
    <main className="mt-10">
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">الشهرية</h1>
            <p className="text-gray-600">برجاء اختيار الشهر لعرض حالة الدفعات الشهرية</p>
          </div>

          {/* Date Picker Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">اختر الشهر</h2>
                <p className="text-sm text-gray-500">اختر الشهر لعرض حالة الدفعات الشهرية</p>
              </div>

              <div className="shrink-0">
                <DatePicker
                  selected={selectedDate}
                  locale="ar-SA"
                  onChange={handleDateChange}
                  dateFormat="MMMM yyyy"
                  showMonthYearPicker
                  className="w-full sm:w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-colors duration-200 text-center"
                  placeholderText="اختر الشهر"
                />
              </div>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <div className="text-2xl font-bold text-gray-900">{totalFloors}</div>
              <div className="text-gray-600">إجمالي الطوابق</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <div className="text-2xl font-bold text-green-600">{totalPaid}</div>
              <div className="text-gray-600">الطوابق المسددة</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
              <div className="text-2xl font-bold text-blue-600">{paymentRate}%</div>
              <div className="text-gray-600">نسبة التحصيل</div>
            </div>
          </div>

          {/* Table Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">حالة الدفعات الشهرية</h2>
              <p className="text-sm text-gray-500 mt-1">
                عرض حالة الدفعات لشهر{" "}
                {selectedDate?.toLocaleDateString("ar", { month: "long", year: "numeric" })} -
                المطلوب: {monthlyRequired.toLocaleString("ar-EG")} ج.م لكل طابق
              </p>
            </div>

            {/* Table Container */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      الطابق
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                      حالة الدفع
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                      تاريخ الدفع
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        جاري تحميل البيانات...
                      </td>
                    </tr>
                  ) : paymentStatus.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                        لا توجد بيانات للعرض
                      </td>
                    </tr>
                  ) : (
                    paymentStatus.map((item, index) => (
                      <tr
                        key={item.floorId}
                        className={`hover:bg-gray-50 transition-colors duration-150 ${
                          index % 2 === 0 ? "bg-white" : "bg-gray-50"
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">
                          <div className="flex items-center justify-end">
                            <FiHome className="ml-2 text-gray-400" />
                            {item.floorName}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-center">
                          <div
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              item.hasPaid
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {item.hasPaid ? (
                              <>
                                <FiCheck className="ml-1" />
                                مسدد
                              </>
                            ) : (
                              <>
                                <FiX className="ml-1" />
                                غير مسدد
                              </>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                          {item.hasPaid && item.paymentDate ? (
                            formatDate(item.paymentDate)
                          ) : (
                            <span className="text-red-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500">
                <span>عرض {paymentStatus.length} طابق</span>
                <span className="mt-2 sm:mt-0">
                  اخر تحديث:{" "}
                  {new Date().toLocaleDateString("ar", {
                    month: "long",
                    year: "numeric",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
