// components/modals/ManagePaymentsModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FiEdit,
  FiTrash2,
  FiSave,
  FiX,
  FiDollarSign,
  FiCalendar,
  FiHome,
  FiTool,
  FiAlertTriangle,
  FiTrendingUp,
} from "react-icons/fi";
import { Spinner } from "../LoadingSpinner";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ar } from "date-fns/locale";

interface ManagePaymentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Payment {
  id: string;
  type: "monthly" | "event";
  floorId: string;
  floorName?: string;
  amountPaid: number;
  originalAmount: number;
  paymentDate: string;
  month?: string;
  eventId?: string;
  eventName?: string;
  collectionName: "monthlyPayments" | "eventPayments";
}

interface EditFormData {
  amountPaid: string;
  paymentMonth?: Date;
}

interface FinancialData {
  totalBalance: number;
}

export default function ManagePaymentsModal({ isOpen, onClose }: ManagePaymentsModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financialData, setFinancialData] = useState<FinancialData>({ totalBalance: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    amountPaid: "",
  });
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState<Payment | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPayments();
      loadFinancialData();
    }
  }, [isOpen]);

  const loadFinancialData = async () => {
    try {
      const balanceDoc = await getDoc(doc(db, "system", "balance"));
      setFinancialData({
        totalBalance: balanceDoc.data()?.totalBalance || 0,
      });
    } catch (err) {
      console.error("Error loading financial data:", err);
    }
  };

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const floorsSnapshot = await getDocs(collection(db, "floors"));
      const floorsMap = new Map(floorsSnapshot.docs.map((d) => [d.id, d.data().floorNumber]));

      const getFloorName = (floorNumber: number) =>
        floorNumber === 0 ? "الطابق الأرضي" : `الطابق ${floorNumber}`;

      const eventsSnapshot = await getDocs(collection(db, "events"));
      const eventsMap = new Map(eventsSnapshot.docs.map((d) => [d.id, d.data().eventName_ar]));

      // Fetch monthly payments
      const monthlyPaymentsSnapshot = await getDocs(collection(db, "monthlyPayments"));
      const monthlyPayments: Payment[] = monthlyPaymentsSnapshot.docs.map((d) => {
        const data = d.data();
        const floorNumber = floorsMap.get(data.floorId);
        return {
          id: d.id,
          type: "monthly",
          floorId: data.floorId,
          floorName: floorNumber !== undefined ? getFloorName(floorNumber) : "غير معروف",
          amountPaid: data.amountPaid,
          originalAmount: data.amountPaid,
          paymentDate: data.paymentDate,
          month: data.month,
          collectionName: "monthlyPayments",
        };
      });

      // Fetch event payments
      const eventPaymentsSnapshot = await getDocs(collection(db, "eventPayments"));
      const eventPayments: Payment[] = eventPaymentsSnapshot.docs.map((d) => {
        const data = d.data();
        const floorNumber = floorsMap.get(data.floorId);
        return {
          id: d.id,
          type: "event",
          floorId: data.floorId,
          floorName: floorNumber !== undefined ? getFloorName(floorNumber) : "غير معروف",
          amountPaid: data.amountPaid,
          originalAmount: data.amountPaid,
          paymentDate: data.paymentDate,
          eventId: data.eventId,
          eventName: eventsMap.get(data.eventId) || "حدث محذوف",
          collectionName: "eventPayments",
        };
      });

      const allPayments = [...monthlyPayments, ...eventPayments];
      allPayments.sort(
        (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
      );

      setPayments(allPayments);
    } catch (err) {
      console.error("Error loading payments:", err);
      setError("حدث خطأ في تحميل الدفعات");
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (payment: Payment) => {
    setEditingPaymentId(payment.id);
    const editData: EditFormData = {
      amountPaid: payment.amountPaid.toString(),
    };

    // Only add paymentMonth for monthly payments
    if (payment.type === "monthly" && payment.month) {
      const [year, month] = payment.month.split("-");
      editData.paymentMonth = new Date(parseInt(year), parseInt(month) - 1);
    }

    setEditFormData(editData);
    setError("");
    setSuccess("");
  };

  const cancelEditing = () => {
    setEditingPaymentId(null);
    setEditFormData({ amountPaid: "" });
  };

  const handleEditChange = (field: keyof EditFormData, value: string | Date) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  };

  const calculateBalanceChange = (): number => {
    if (!editingPaymentId) return 0;

    const paymentToEdit = payments.find((p) => p.id === editingPaymentId);
    if (!paymentToEdit) return 0;

    const newAmount = parseFloat(editFormData.amountPaid) || 0;
    return newAmount - paymentToEdit.originalAmount;
  };

  const savePayment = async () => {
    if (!editingPaymentId) return;

    const amount = parseFloat(editFormData.amountPaid);
    if (isNaN(amount) || amount <= 0) {
      setError("يرجى إدخال مبلغ صحيح.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const paymentToEdit = payments.find((p) => p.id === editingPaymentId);
      if (!paymentToEdit) throw new Error("Payment not found");

      const batch = writeBatch(db);

      // Prepare update data based on payment type
      const updateData: any = {
        amountPaid: amount,
      };

      // Only update month for monthly payments
      if (paymentToEdit.type === "monthly" && editFormData.paymentMonth) {
        const year = editFormData.paymentMonth.getFullYear();
        const month = String(editFormData.paymentMonth.getMonth() + 1).padStart(2, "0");
        updateData.month = `${year}-${month}`;
      }

      // Update payment document
      const paymentRef = doc(db, paymentToEdit.collectionName, editingPaymentId);
      batch.update(paymentRef, updateData);

      // Update balance
      const balanceRef = doc(db, "system", "balance");
      const balanceDoc = await getDoc(balanceRef);
      const currentBalance = balanceDoc.data()?.totalBalance || 0;
      const balanceChange = amount - paymentToEdit.originalAmount;
      const newBalance = currentBalance + balanceChange;
      batch.update(balanceRef, { totalBalance: newBalance });

      await batch.commit();

      setSuccess("تم تحديث الدفعة بنجاح");
      setEditingPaymentId(null);
      await loadPayments();
      await loadFinancialData();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error updating payment:", err);
      setError("حدث خطأ في تحديث الدفعة.");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = (payment: Payment) => {
    setDeleteConfirmPayment(payment);
    setError("");
    setSuccess("");
  };

  const cancelDelete = () => {
    setDeleteConfirmPayment(null);
  };

  const deletePayment = async () => {
    if (!deleteConfirmPayment) return;

    setLoading(true);
    setError("");
    try {
      const batch = writeBatch(db);

      // Delete payment document
      const paymentRef = doc(db, deleteConfirmPayment.collectionName, deleteConfirmPayment.id);
      batch.delete(paymentRef);

      // Update balance
      const balanceRef = doc(db, "system", "balance");
      const balanceDoc = await getDoc(balanceRef);
      const currentBalance = balanceDoc.data()?.totalBalance || 0;
      const newBalance = currentBalance - deleteConfirmPayment.amountPaid;
      batch.update(balanceRef, { totalBalance: newBalance });

      await batch.commit();

      setSuccess("تم حذف الدفعة بنجاح");
      setDeleteConfirmPayment(null);
      await loadPayments();
      await loadFinancialData();

      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error deleting payment:", err);
      setError("حدث خطأ في حذف الدفعة");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });

  const getMonthName = (monthString: string) => {
    const [year, month] = monthString.split("-");
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
    });
  };

  const getPaymentTypeIcon = (type: "monthly" | "event") => {
    return type === "monthly" ? (
      <FiHome className="text-green-600" />
    ) : (
      <FiTool className="text-purple-600" />
    );
  };

  const getPaymentTypeColor = (type: "monthly" | "event") => {
    return type === "monthly" ? "bg-green-100 text-green-800" : "bg-purple-100 text-purple-800";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 shrink-0">
          <div>
            <h3 className="text-xl font-semibold text-gray-900">إدارة الدفعات</h3>
            <p className="text-sm text-gray-600 mt-1">
              الرصيد الحالي: {financialData.totalBalance.toLocaleString("ar-EG")} ج.م
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-3">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4 text-sm">
                {success}
              </div>
            )}

            {/* Delete Confirmation */}
            {deleteConfirmPayment && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                <div className="flex items-start">
                  <FiAlertTriangle className="text-red-600 text-xl mt-1 ml-3" />
                  <div className="text-right flex-1">
                    <h4 className="text-lg font-semibold text-red-800 mb-2">تأكيد الحذف</h4>
                    <p className="text-red-700 mb-2">هل أنت متأكد من حذف هذه الدفعة؟</p>
                    <p className="text-red-600 text-sm mb-4">
                      سيتم خصم {deleteConfirmPayment.amountPaid.toLocaleString("ar-EG")} ج.م من
                      الرصيد الإجمالي. الرصيد الجديد سيكون:{" "}
                      {(
                        financialData.totalBalance - deleteConfirmPayment.amountPaid
                      ).toLocaleString("ar-EG")}{" "}
                      ج.م
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={cancelDelete}
                        disabled={loading}
                        className="flex-1 py-2 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                      >
                        إلغاء
                      </button>
                      <button
                        onClick={deletePayment}
                        disabled={loading}
                        className="flex-1 py-2 px-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-medium flex items-center justify-center whitespace-nowrap"
                      >
                        {loading ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent ml-2"></div>
                            جاري الحذف...
                          </div>
                        ) : (
                          <>
                            <FiTrash2 className="ml-2" />
                            نعم، احذف الدفعة
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && !deleteConfirmPayment && (
              <div className="flex justify-center items-center py-12">
                <Spinner />
                <span className="mr-3 text-gray-600">جاري تحميل البيانات...</span>
              </div>
            )}

            {/* Empty State */}
            {!loading && payments.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FiTrendingUp className="text-4xl mx-auto mb-4 text-gray-400" />
                <p className="text-lg">لا توجد دفعات مسجلة</p>
                <p className="text-sm mt-2">سيظهر هنا جميع الدفعات الشهرية ودفعات الأحداث</p>
              </div>
            )}

            {/* Payments List */}
            {!loading && payments.length > 0 && (
              <div className="space-y-4">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className={`border-2 rounded-xl p-5 transition-all duration-200 ${
                      editingPaymentId === payment.id
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
                    }`}
                  >
                    {editingPaymentId === payment.id ? (
                      // Edit View
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <h4 className="text-lg font-semibold text-blue-700">تعديل الدفعة</h4>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <FiX className="text-xl" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Amount Input */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                              المبلغ
                            </label>
                            <div className="relative">
                              <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                              <input
                                type="number"
                                value={editFormData.amountPaid}
                                onChange={(e) => handleEditChange("amountPaid", e.target.value)}
                                className="w-full pr-3 pl-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                dir="ltr"
                                min="0"
                                step="0.01"
                              />
                            </div>
                          </div>

                          {/* Month Picker (only for monthly payments) */}
                          {payment.type === "monthly" && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                                الشهر
                              </label>
                              <DatePicker
                                selected={editFormData.paymentMonth}
                                onChange={(date: Date | null) =>
                                  date && handleEditChange("paymentMonth", date)
                                }
                                dateFormat="MMMM yyyy"
                                showMonthYearPicker
                                locale={ar}
                                className="w-full px-3 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right"
                                placeholderText="اختر الشهر"
                              />
                            </div>
                          )}
                        </div>

                        {/* Balance Change Preview */}
                        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-gray-600">التأثير على الرصيد:</span>
                            <span
                              className={`font-semibold ${
                                calculateBalanceChange() > 0
                                  ? "text-green-600"
                                  : calculateBalanceChange() < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                              }`}
                            >
                              {calculateBalanceChange() > 0 ? "+" : ""}
                              {calculateBalanceChange().toLocaleString("ar-EG")} ج.م
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm mt-1">
                            <span className="text-gray-600">الرصيد الجديد:</span>
                            <span className="font-semibold text-blue-600">
                              {(
                                financialData.totalBalance + calculateBalanceChange()
                              ).toLocaleString("ar-EG")}{" "}
                              ج.م
                            </span>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={cancelEditing}
                            className="flex-1 py-3 px-4 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                          >
                            إلغاء
                          </button>
                          <button
                            onClick={savePayment}
                            disabled={loading}
                            className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center justify-center whitespace-nowrap"
                          >
                            {loading ? (
                              <div className="flex items-center">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent ml-2"></div>
                                جاري الحفظ...
                              </div>
                            ) : (
                              <>
                                <FiSave className="ml-2" />
                                حفظ التغييرات
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View Mode
                      <div className="flex items-start justify-between">
                        <div className="flex-1 text-right">
                          <div className="flex items-center gap-4 justify-end mb-3">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium border ${getPaymentTypeColor(
                                payment.type
                              )}`}
                            >
                              {payment.type === "monthly" ? "دفعة شهرية" : "دفعة حدث"}
                            </span>
                            <div className="font-bold text-xl text-gray-900">
                              {payment.amountPaid.toLocaleString("ar-EG")} ج.م
                            </div>
                          </div>

                          <div className="text-sm text-gray-600 space-y-2">
                            <div className="flex items-center justify-end gap-2">
                              {getPaymentTypeIcon(payment.type)}
                              <span className="font-medium">{payment.floorName}</span>
                            </div>

                            {payment.type === "monthly" && payment.month && (
                              <div className="flex items-center justify-end gap-2">
                                <FiCalendar className="text-gray-500" />
                                <span>شهر: {getMonthName(payment.month)}</span>
                              </div>
                            )}

                            {payment.type === "event" && payment.eventName && (
                              <div className="flex items-center justify-end gap-2">
                                <FiTool className="text-gray-500" />
                                <span>الحدث: {payment.eventName}</span>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-1 whitespace-nowrap">
                              <FiCalendar className="text-gray-500" />
                              <span className="text-xs text-gray-500">
                                تاريخ التسجيل: {formatDate(payment.paymentDate)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 mr-4">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(payment)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <FiEdit className="text-lg" />
                            </button>
                            <button
                              onClick={() => confirmDelete(payment)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <FiTrash2 className="text-lg" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 shrink-0">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              إجمالي الدفعات: <span className="font-medium">{payments.length}</span>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors font-medium"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
