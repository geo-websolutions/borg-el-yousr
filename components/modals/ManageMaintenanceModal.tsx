// components/modals/ManageMaintenanceModal.tsx
"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  FiEdit,
  FiTrash2,
  FiSave,
  FiX,
  FiTool,
  FiDollarSign,
  FiFileText,
  FiCheck,
  FiAlertTriangle,
} from "react-icons/fi";
import { Spinner } from "../LoadingSpinner";

interface ManageMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Event {
  id: string;
  eventName_ar: string;
  description: string;
  totalCost: number;
  costPerFloor: number;
  date: string;
  status: "open" | "closed";
  collectedAmount?: number;
}

interface EditFormData {
  eventName_ar: string;
  description: string;
  totalCost: string;
  status: "open" | "closed";
}

export default function ManageMaintenanceModal({ isOpen, onClose }: ManageMaintenanceModalProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    eventName_ar: "",
    description: "",
    totalCost: "",
    status: "open",
  });
  const [deleteConfirmEvent, setDeleteConfirmEvent] = useState<string | null>(null);

  // Load events when modal opens
  useEffect(() => {
    if (isOpen) {
      loadEvents();
    }
  }, [isOpen]);

  /**
   * Loads all events from Firestore with their payment data
   */
  const loadEvents = async () => {
    try {
      setLoading(true);

      const eventsSnapshot = await getDocs(collection(db, "events"));
      const eventPaymentsSnapshot = await getDocs(collection(db, "eventPayments"));

      const eventsData = eventsSnapshot.docs.map((doc) => {
        const eventData = doc.data();
        // Calculate collected amount for each event
        const eventPayments = eventPaymentsSnapshot.docs
          .filter((paymentDoc) => paymentDoc.data().eventId === doc.id)
          .reduce((sum, paymentDoc) => sum + (paymentDoc.data().amountPaid || 0), 0);

        return {
          id: doc.id,
          ...eventData,
          collectedAmount: eventPayments,
        } as Event;
      });

      // Sort events by date (newest first)
      eventsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setEvents(eventsData);
      setLoading(false);
    } catch (err) {
      console.error("Error loading events:", err);
      setError("حدث خطأ في تحميل بيانات الأحداث");
      setLoading(false);
    }
  };

  /**
   * Starts editing an event by populating the form with its data
   */
  const startEditing = (event: Event) => {
    setEditingEventId(event.id);
    setEditFormData({
      eventName_ar: event.eventName_ar,
      description: event.description,
      totalCost: event.totalCost.toString(),
      status: event.status,
    });
    setError("");
    setSuccess("");
  };

  /**
   * Cancels the editing mode
   */
  const cancelEditing = () => {
    setEditingEventId(null);
    setEditFormData({
      eventName_ar: "",
      description: "",
      totalCost: "",
      status: "open",
    });
    setError("");
  };

  /**
   * Updates the edit form data
   */
  const handleEditChange = (field: keyof EditFormData, value: string) => {
    setEditFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Validates and saves the edited event data
   */
  const saveEvent = async () => {
    if (!editingEventId) return;

    // Validate form data
    if (
      !editFormData.eventName_ar.trim() ||
      !editFormData.description.trim() ||
      !editFormData.totalCost
    ) {
      setError("يرجى ملء جميع الحقول");
      return;
    }

    const totalCost = parseFloat(editFormData.totalCost);
    if (isNaN(totalCost) || totalCost <= 0) {
      setError("يرجى إدخال مبلغ صحيح");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Calculate cost per floor based on number of floors
      const floorsSnapshot = await getDocs(collection(db, "floors"));
      const floorsCount = floorsSnapshot.size;
      const costPerFloor = Math.ceil(totalCost / floorsCount);

      // Update event in Firestore
      await updateDoc(doc(db, "events", editingEventId), {
        eventName_ar: editFormData.eventName_ar.trim(),
        description: editFormData.description.trim(),
        totalCost: totalCost,
        costPerFloor: costPerFloor,
        status: editFormData.status,
      });

      // Reload events to reflect changes
      await loadEvents();

      setSuccess("تم تحديث بيانات الحدث بنجاح");
      setEditingEventId(null);
      setLoading(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error updating event:", err);
      setError("حدث خطأ في تحديث بيانات الحدث");
      setLoading(false);
    }
  };

  /**
   * Initiates delete confirmation for an event
   */
  const confirmDelete = (eventId: string) => {
    setDeleteConfirmEvent(eventId);
    setError("");
    setSuccess("");
  };

  /**
   * Cancels delete confirmation
   */
  const cancelDelete = () => {
    setDeleteConfirmEvent(null);
  };

  /**
   * Deletes an event and all its associated payments
   */
  // In deleteEvent function, replace the current implementation with:
  const deleteEvent = async () => {
    if (!deleteConfirmEvent) return;

    setLoading(true);
    setError("");

    try {
      // Query event payments for this specific event (more efficient than filtering locally)
      const eventPaymentsQuery = query(
        collection(db, "eventPayments"),
        where("eventId", "==", deleteConfirmEvent)
      );
      const eventPaymentsSnapshot = await getDocs(eventPaymentsQuery);

      // Calculate total payments amount to deduct from balance
      const totalPaymentsAmount = eventPaymentsSnapshot.docs.reduce(
        (sum, doc) => sum + (doc.data().amountPaid || 0),
        0
      );

      // Query expenses for this specific event
      const eventExpensesQuery = query(
        collection(db, "expenses"),
        where("eventId", "==", deleteConfirmEvent)
      );
      const eventExpensesSnapshot = await getDocs(eventExpensesQuery);

      // Calculate total expenses amount to add back to balance (since expenses were deducted)
      const totalExpensesAmount = eventExpensesSnapshot.docs.reduce(
        (sum, doc) => sum + (doc.data().amount || 0),
        0
      );

      // Get current balance
      const balanceDoc = await getDoc(doc(db, "system", "balance"));
      const currentBalance = balanceDoc.data()?.totalBalance || 0;

      // Calculate new balance:
      // current - payments (since payments were added to balance) + expenses (since expenses were deducted)
      const newBalance = currentBalance - totalPaymentsAmount + totalExpensesAmount;

      // Delete all event payments
      const deletePaymentPromises = eventPaymentsSnapshot.docs.map((paymentDoc) =>
        deleteDoc(paymentDoc.ref)
      );

      // Delete all event expenses
      const deleteExpensePromises = eventExpensesSnapshot.docs.map((expenseDoc) =>
        deleteDoc(expenseDoc.ref)
      );

      // Execute all deletions
      await Promise.all([...deletePaymentPromises, ...deleteExpensePromises]);

      // Delete the event itself
      await deleteDoc(doc(db, "events", deleteConfirmEvent));

      // Update system balance with corrected amount
      await updateDoc(doc(db, "system", "balance"), {
        totalBalance: newBalance,
        lastUpdated: new Date().toISOString(),
      });

      // Reload events to reflect changes
      await loadEvents();

      setSuccess("تم حذف الحدث وجميع بياناته المالية بنجاح");
      setDeleteConfirmEvent(null);
      setLoading(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error deleting event:", err);
      setError("حدث خطأ في حذف الحدث");
      setLoading(false);
    }
  };

  /**
   * Gets the display name for event status
   */
  const getStatusDisplay = (status: "open" | "closed") => {
    return status === "open" ? "نشط" : "مغلق";
  };

  /**
   * Gets the CSS classes for status badge
   */
  const getStatusClasses = (status: "open" | "closed") => {
    return status === "open"
      ? "bg-green-100 text-green-800 border-green-200"
      : "bg-gray-100 text-gray-800 border-gray-200";
  };

  /**
   * Formats date for display
   */
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
    });
  };

  // Don't render if modal is not open
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-lg flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[95vh] flex flex-col">
        {/* Header - Fixed */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200 shrink-0">
          <h3 className="text-xl font-semibold text-gray-900">إدارة أحداث الصيانة</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl transition-colors"
            disabled={loading}
          >
            ✕
          </button>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Messages */}
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

            {/* Loading State */}
            {loading && !editingEventId && !deleteConfirmEvent && (
              <div className="flex justify-center items-center py-12">
                <Spinner />
                <span className="mr-3 text-gray-600">جاري تحميل البيانات...</span>
              </div>
            )}

            {/* Delete Confirmation Dialog */}
            {deleteConfirmEvent && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-6">
                <div className="flex items-start">
                  <FiAlertTriangle className="text-red-600 text-xl mt-1 ml-3" />
                  <div className="text-right flex-1">
                    <h4 className="text-lg font-semibold text-red-800 mb-2">تأكيد الحذف</h4>
                    <p className="text-red-700 mb-4">
                      هل أنت متأكد من رغبتك في حذف هذا الحدث؟ سيتم حذف جميع بيانات الدفعات المرتبطة
                      به أيضاً و سيتم خصم مجموع الدفعات من الرصيد الحالي. لا يمكن التراجع عن هذا
                      الإجراء.
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
                        onClick={deleteEvent}
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
                            نعم، احذف الحدث
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Events List */}
            {!loading && events.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <FiTool className="text-4xl mx-auto mb-4 text-gray-400" />
                <p className="text-lg">لا توجد أحداث صيانة</p>
                <p className="text-sm mt-2">يمكنك إنشاء أحداث جديدة من خلال زر "حدث صيانة جديد"</p>
              </div>
            )}

            {/* Events Grid */}
            {!loading && events.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className={`border-2 rounded-xl p-5 transition-all duration-200 ${
                      editingEventId === event.id
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    {/* Edit Mode */}
                    {editingEventId === event.id ? (
                      <div className="space-y-4 p-4">
                        <div className="flex justify-between items-start">
                          <h4 className="text-lg font-semibold text-blue-700">تعديل الحدث</h4>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <FiX className="text-xl" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* Event Name */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                              اسم الحدث
                            </label>
                            <div className="relative">
                              <FiTool className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                              <input
                                type="text"
                                value={editFormData.eventName_ar}
                                onChange={(e) => handleEditChange("eventName_ar", e.target.value)}
                                className="w-full pr-3 pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right"
                              />
                            </div>
                          </div>

                          {/* Description */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                              الوصف
                            </label>
                            <div className="relative">
                              <FiFileText className="absolute left-3 top-3 text-gray-400" />
                              <textarea
                                value={editFormData.description}
                                onChange={(e) => handleEditChange("description", e.target.value)}
                                rows={2}
                                className="w-full pr-3 pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900 text-right resize-none"
                              />
                            </div>
                          </div>

                          {/* Total Cost */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                              التكلفة الإجمالية
                            </label>
                            <div className="relative">
                              <FiDollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                              <input
                                type="number"
                                value={editFormData.totalCost}
                                onChange={(e) => handleEditChange("totalCost", e.target.value)}
                                min="0"
                                step="0.01"
                                className="w-full pr-3 pl-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                                dir="ltr"
                              />
                            </div>
                          </div>

                          {/* Status */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 text-right mb-2">
                              الحالة
                            </label>
                            <div className="grid grid-cols-2 gap-3">
                              <button
                                onClick={() => handleEditChange("status", "open")}
                                className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                                  editFormData.status === "open"
                                    ? "border-green-500 bg-green-50 text-green-700"
                                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                                }`}
                              >
                                نشط
                              </button>
                              <button
                                onClick={() => handleEditChange("status", "closed")}
                                className={`p-3 rounded-lg border-2 transition-all duration-200 ${
                                  editFormData.status === "closed"
                                    ? "border-gray-500 bg-gray-50 text-gray-700"
                                    : "border-gray-200 text-gray-700 hover:border-gray-300"
                                }`}
                              >
                                مغلق
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-3 pt-2">
                          <button
                            onClick={cancelEditing}
                            className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                          >
                            إلغاء
                          </button>
                          <button
                            onClick={saveEvent}
                            disabled={loading}
                            className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center whitespace-nowrap"
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
                      /* View Mode */
                      <>
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEditing(event)}
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <FiEdit className="text-lg" />
                            </button>
                            <button
                              onClick={() => confirmDelete(event.id)}
                              className="p-2 text-red-600 hover:bg-red-100 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <FiTrash2 className="text-lg" />
                            </button>
                          </div>
                          <div className="text-right">
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusClasses(
                                event.status
                              )}`}
                            >
                              {getStatusDisplay(event.status)}
                            </span>
                            <p className="text-gray-500 text-sm mt-1">{formatDate(event.date)}</p>
                          </div>
                        </div>

                        <h4 className="text-lg font-semibold text-gray-900 mb-2">
                          {event.eventName_ar}
                        </h4>
                        <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                          {event.description}
                        </p>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div className="text-center bg-blue-50 rounded-lg p-3">
                            <FiDollarSign className="text-blue-600 mx-auto mb-1" />
                            <div className="font-semibold text-blue-700">
                              {event.totalCost.toLocaleString("ar-EG")} ج.م
                            </div>
                            <div className="text-blue-600 text-xs">التكلفة الإجمالية</div>
                          </div>
                          <div className="text-center bg-green-50 rounded-lg p-3">
                            <FiCheck className="text-green-600 mx-auto mb-1" />
                            <div className="font-semibold text-green-700">
                              {event.costPerFloor.toLocaleString("ar-EG")} ج.م
                            </div>
                            <div className="text-green-600 text-xs">لكل طابق</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-4">
                          <div className="flex justify-between text-sm text-gray-600 mb-1">
                            <span>
                              المجموع: {event.collectedAmount?.toLocaleString("ar-EG") || 0} ج.م
                            </span>
                            <span>التكلفة: {event.totalCost.toLocaleString("ar-EG")} ج.م</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{
                                width: `${Math.min(
                                  100,
                                  ((event.collectedAmount || 0) / event.totalCost) * 100
                                )}%`,
                              }}
                            ></div>
                          </div>
                          <div className="text-xs text-gray-500 text-center mt-1">
                            {Math.min(
                              100,
                              Math.round(((event.collectedAmount || 0) / event.totalCost) * 100)
                            )}
                            % مكتمل
                          </div>
                        </div>
                      </>
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
              إجمالي الأحداث: <span className="font-medium">{events.length}</span>
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
