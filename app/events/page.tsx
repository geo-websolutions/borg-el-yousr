// app/events/page.tsx
"use client";

import { useState, useEffect } from "react";
import { collection, query, getDocs, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { FiCheck, FiX, FiHome, FiCalendar } from "react-icons/fi";

interface Event {
  id: string;
  eventName_ar: string;
  description: string;
  totalCost: number;
  costPerFloor: number;
  date: any; // Firestore timestamp
  status: "open" | "closed";
}

interface Floor {
  id: string;
  floorNumber: number;
}

interface EventPaymentStatus {
  floorId: string;
  floorName: string;
  hasPaid: boolean;
  amountPaid?: number;
  remainingAmount?: number;
  isComplete?: boolean;
  paymentDate?: string;
}

export default function EventsPage() {
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [floors, setFloors] = useState<Floor[]>([]);
  const [paymentStatus, setPaymentStatus] = useState<EventPaymentStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [eventsLoading, setEventsLoading] = useState(false);

  useEffect(() => {
    loadEventsAndFloors();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadEventPaymentStatus();
    } else {
      setPaymentStatus([]);
    }
  }, [selectedEvent]);

  const loadEventsAndFloors = async () => {
    setEventsLoading(true);
    try {
      // Load events
      const eventsSnapshot = await getDocs(collection(db, "events"));
      const eventsData = eventsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Event[];

      // Sort events by date (newest first)
      eventsData.sort((a, b) => {
        const dateA = a.date?.toDate?.() || new Date(0);
        const dateB = b.date?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

      setEvents(eventsData);

      // Load floors
      const floorsSnapshot = await getDocs(collection(db, "floors"));
      const floorsData = floorsSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Floor[];

      floorsData.sort((a, b) => a.floorNumber - b.floorNumber);
      setFloors(floorsData);

      // Auto-select the first event if available
      if (eventsData.length > 0) {
        setSelectedEvent(eventsData[0]);
      }
    } catch (error) {
      console.error("Error loading events and floors:", error);
    } finally {
      setEventsLoading(false);
    }
  };

  const loadEventPaymentStatus = async () => {
    if (!selectedEvent) return;

    setLoading(true);
    try {
      // Query event payments for selected event
      const paymentsQuery = query(
        collection(db, "eventPayments"),
        where("eventId", "==", selectedEvent.id)
      );
      const paymentsSnapshot = await getDocs(paymentsQuery);

      const paidFloors = new Map();

      paymentsSnapshot.docs.forEach((doc) => {
        const data = doc.data();
        paidFloors.set(data.floorId, {
          amountPaid: data.amountPaid,
          remainingAmount: data.remainingAmount,
          isComplete: data.isComplete,
          paymentDate: data.paymentDate,
        });
      });

      // Create payment status array
      const statusData: EventPaymentStatus[] = floors.map((floor) => {
        const paymentData = paidFloors.get(floor.id);
        const hasPayment = paidFloors.has(floor.id);
        const floorName = floor.floorNumber === 0 ? "الطابق الأرضي" : `الطابق ${floor.floorNumber}`;

        return {
          floorId: floor.id,
          floorName,
          hasPaid: hasPayment && paymentData?.isComplete,
          amountPaid: paymentData?.amountPaid,
          remainingAmount: paymentData?.remainingAmount,
          isComplete: paymentData?.isComplete,
          paymentDate: paymentData?.paymentDate,
        };
      });

      setPaymentStatus(statusData);
    } catch (error) {
      console.error("Error loading event payment status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEventChange = (eventId: string) => {
    const event = events.find((e) => e.id === eventId) || null;
    setSelectedEvent(event);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch (error) {
      return "-";
    }
  };

  const formatCurrency = (amount: number) => {
    return amount?.toLocaleString("ar-EG") || "0";
  };

  const getEventStatusBadge = (status: "open" | "closed") => {
    const styles = {
      open: "bg-green-100 text-green-800",
      closed: "bg-gray-100 text-gray-800",
    };

    const labels = {
      open: "مفتوح",
      closed: "مغلق",
    };

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const totalPaid = paymentStatus.filter((item) => item.hasPaid).length;
  const totalFloors = floors.length;
  const paymentRate = totalFloors > 0 ? Math.round((totalPaid / totalFloors) * 100) : 0;
  const totalCollected = paymentStatus.reduce((sum, item) => sum + (item.amountPaid || 0), 0);
  const totalExpected = selectedEvent ? selectedEvent.costPerFloor * totalFloors : 0;

  return (
    <main className="mt-10">
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">الاحداث</h1>
            <p className="text-gray-600">برجاء اختيار الحدث لعرض حالة الدفعات</p>
          </div>

          {/* Event Selector Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-1">اختر الحدث</h2>
                <p className="text-sm text-gray-500">اختر الحدث لعرض حالة الدفعات</p>
              </div>

              <div className="shrink-0">
                {eventsLoading ? (
                  <div className="w-64 px-4 py-2 text-center text-gray-500">
                    جاري تحميل الاحداث...
                  </div>
                ) : (
                  <select
                    value={selectedEvent?.id || ""}
                    onChange={(e) => handleEventChange(e.target.value)}
                    className="w-full sm:w-64 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 bg-white transition-colors duration-200 text-right"
                  >
                    <option value="">اختر الحدث</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.eventName_ar}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Event Details */}
            {selectedEvent && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {selectedEvent.eventName_ar}
                    </h3>
                    <p className="text-gray-600 text-sm mb-2">{selectedEvent.description}</p>
                    <div className="flex items-center gap-2">
                      <FiCalendar className="text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {formatDate(selectedEvent.date)}
                      </span>
                      {getEventStatusBadge(selectedEvent.status)}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-gray-600">التكلفة الإجمالية</div>
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(selectedEvent.totalCost)} ج.م
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-gray-600">المطلوب لكل طابق</div>
                      <div className="font-semibold text-gray-900">
                        {formatCurrency(selectedEvent.costPerFloor)} ج.م
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          {selectedEvent && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
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
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {formatCurrency(totalCollected)} ج.م
                  </div>
                  <div className="text-gray-600">المجموع المحصل</div>
                </div>
              </div>

              {/* Table Card */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">حالة الدفعات للفعالية</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    عرض حالة الدفعات لفعالية "{selectedEvent.eventName_ar}" - المطلوب:{" "}
                    {formatCurrency(selectedEvent.costPerFloor)} ج.م لكل طابق
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
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          المدفوع
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200">
                          المتبقي
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 whitespace-nowrap">
                          تاريخ الدفع
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {loading ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                            جاري تحميل البيانات...
                          </td>
                        </tr>
                      ) : paymentStatus.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
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
                                    : item.amountPaid && item.amountPaid > 0
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-red-100 text-red-800"
                                }`}
                              >
                                {item.hasPaid ? (
                                  <>
                                    <FiCheck className="ml-1" />
                                    مسدد بالكامل
                                  </>
                                ) : item.amountPaid && item.amountPaid > 0 ? (
                                  <>
                                    <FiCheck className="ml-1" />
                                    مدفوعة جزئياً
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
                              {formatCurrency(item.amountPaid || 0)} ج.م
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {item.hasPaid ? (
                                <span className="text-green-600">0 ج.م</span>
                              ) : (
                                <span className="text-red-600">
                                  {formatCurrency(
                                    item.remainingAmount || selectedEvent.costPerFloor
                                  )}{" "}
                                  ج.م
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                              {item.paymentDate ? (
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
                    <div className="mt-2 sm:mt-0 flex flex-col sm:flex-row gap-2 sm:gap-4">
                      <span>
                        المجموع المحصل: <strong>{formatCurrency(totalCollected)} ج.م</strong>
                      </span>
                      <span>
                        المجموع المتوقع: <strong>{formatCurrency(totalExpected)} ج.م</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
