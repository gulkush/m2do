window.todoApp = function todoApp() {
  return {
    assignees: ["MNB", "SHR", "PRD", "SMB", "GMB"],
    assigneeRowClasses: {
      MNB: "bg-rose-50",
      SHR: "bg-amber-50",
      PRD: "bg-emerald-50",
      SMB: "bg-sky-50",
      GMB: "bg-violet-50",
    },
    selectedToTab: "All",
    tasks: [],
    modalOpen: false,
    historyModalOpen: false,
    editingTaskId: null,
    historyTaskTitle: "",
    historyEntries: [],
    saving: false,
    firebaseError: "",
    authError: "",
    authLoading: false,
    authUser: null,
    unsubscribeTasks: null,
    form: {
      date: "",
      to: "",
      subject: "",
      details: "",
      status: "Open",
      history: [],
    },

    init() {
      this.form.to = this.assignees[0];
      this.form.date = this.todayISO();
      this.setupFirebase();
    },

    get toTabs() {
      return ["All", ...this.assignees];
    },

    get todayTasks() {
      const today = this.todayISO();
      return this.tasks
        .filter((task) => this.matchesToTab(task))
        .filter((task) => task.date <= today)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    },

    get futureTasks() {
      const today = this.todayISO();
      return this.tasks
        .filter((task) => this.matchesToTab(task))
        .filter((task) => task.date > today)
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    },

    get closedTasks() {
      return this.tasks
        .filter((task) => this.matchesToScope(task))
        .filter((task) => task.status === "Closed")
        .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    },

    get historyRows() {
      return (this.historyEntries || []).map((entry) => ({
        created: entry.action || "UPDATED",
        time: entry.timestamp ? new Date(entry.timestamp).toLocaleString() : "-",
        changes: Object.entries(entry.changes || {})
          .map(([field, value]) => {
            if (Object.prototype.hasOwnProperty.call(value, "from")) {
              return `${field}: "${value.from}" -> "${value.to}"`;
            }
            return `${field}: "${value.to}"`;
          })
          .join("\n"),
      }));
    },

    setupFirebase() {
      try {
        if (!window.firebaseConfig || !window.firebaseConfig.apiKey || window.firebaseConfig.apiKey.includes("YOUR_")) {
          this.firebaseError = "Update firebase-config.js with your Firebase project values.";
          return;
        }

        if (!firebase.apps.length) {
          firebase.initializeApp(window.firebaseConfig);
        }
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        this.setupAuthListener();
      } catch (err) {
        this.firebaseError = `Firebase init failed: ${err.message}`;
      }
    },

    setupAuthListener() {
      if (!this.auth) return;

      this.auth.onAuthStateChanged(async (user) => {
        this.authUser = user;

        if (user) {
          this.authError = "";
          this.subscribeToTasks();
          return;
        }

        if (this.unsubscribeTasks) {
          this.unsubscribeTasks();
          this.unsubscribeTasks = null;
        }
        this.tasks = [];
        this.modalOpen = false;

        this.authLoading = true;
        try {
          await this.auth.signInAnonymously();
        } catch (err) {
          this.authError = `Anonymous sign-in failed: ${err.message}`;
        } finally {
          this.authLoading = false;
        }
      });
    },

    subscribeToTasks() {
      if (!this.db) return;
      if (this.unsubscribeTasks) {
        this.unsubscribeTasks();
      }

      this.unsubscribeTasks = this.db.collection("m2do_tasks").onSnapshot(
        (snapshot) => {
          this.tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        },
        (err) => {
          this.firebaseError = `Failed to load tasks: ${err.message}`;
        }
      );
    },

    todayISO() {
      return new Date().toISOString().split("T")[0];
    },

    matchesToTab(task) {
      return this.matchesToScope(task) && task.status === "Open";
    },

    matchesToScope(task) {
      return this.selectedToTab === "All" || task.to === this.selectedToTab;
    },

    taskCountForToTab(tab) {
      if (tab === "All") return this.tasks.filter((task) => task.status === "Open").length;
      return this.tasks.filter((task) => task.status === "Open" && task.to === tab).length;
    },

    rowClass(task) {
      return this.assigneeRowClasses[task.to] || "bg-slate-50";
    },

    get canDeleteCurrentTask() {
      if (!this.editingTaskId) return false;
      const detailsValue = (this.form.details || "").trim();
      return this.form.status === "Closed" && detailsValue === "";
    },

    toTabClass(tab) {
      if (this.selectedToTab === tab) {
        if (tab === "All") return "bg-slate-600 text-white";
        const active = {
          MNB: "bg-rose-600 text-white",
          SHR: "bg-amber-600 text-white",
          PRD: "bg-emerald-600 text-white",
          SMB: "bg-sky-600 text-white",
          GMB: "bg-violet-600 text-white",
        };
        return active[tab] || "bg-slate-900 text-white";
      }

      if (tab === "All") return "bg-slate-200 text-slate-700 hover:bg-slate-300";
      const inactive = {
        MNB: "bg-rose-100 text-rose-800 hover:bg-rose-200",
        SHR: "bg-amber-100 text-amber-800 hover:bg-amber-200",
        PRD: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
        SMB: "bg-sky-100 text-sky-800 hover:bg-sky-200",
        GMB: "bg-violet-100 text-violet-800 hover:bg-violet-200",
      };
      return inactive[tab] || "bg-slate-100 text-slate-700 hover:bg-slate-200";
    },

    async signOut() {
      if (!this.auth) {
        this.authError = "Firebase Auth is not initialized.";
        return;
      }
      await this.auth.signOut();
    },

    openCreateModal() {
      if (!this.authUser) return;
      this.editingTaskId = null;
      this.form = {
        date: this.todayISO(),
        to: this.assignees[0],
        subject: "",
        details: "",
        status: "Open",
        history: [],
      };
      this.modalOpen = true;
    },

    openEditModal(task) {
      this.editingTaskId = task.id;
      this.form = {
        date: task.date,
        to: task.to,
        subject: task.subject,
        details: task.details,
        status: task.status,
        history: Array.isArray(task.history) ? [...task.history] : [],
      };
      this.modalOpen = true;
    },

    closeModal() {
      this.modalOpen = false;
      this.saving = false;
    },

    openHistoryModal(task) {
      this.historyTaskTitle = task.subject || "Task";
      this.historyEntries = Array.isArray(task.history) ? [...task.history] : [];
      this.historyModalOpen = true;
    },

    closeHistoryModal() {
      this.historyModalOpen = false;
      this.historyTaskTitle = "";
      this.historyEntries = [];
    },

    async deleteCurrentTask() {
      if (!this.db || !this.editingTaskId || !this.canDeleteCurrentTask) return;
      const ok = window.confirm("Delete this closed task?");
      if (!ok) return;

      this.saving = true;
      try {
        await this.db.collection("m2do_tasks").doc(this.editingTaskId).delete();
        this.closeModal();
      } catch (err) {
        this.firebaseError = `Delete failed: ${err.message}`;
      } finally {
        this.saving = false;
      }
    },

    async toggleTaskStatus(task) {
      if (!this.db || !task || !task.id) return;
      const fromStatus = task.status === "Closed" ? "Closed" : "Open";
      const toStatus = fromStatus === "Open" ? "Closed" : "Open";
      const confirmMessage = `Do you want change the status from ${fromStatus.toLowerCase()} to ${toStatus.toLowerCase()}?`;
      if (!window.confirm(confirmMessage)) return;

      const statusHistoryEntry = {
        action: "UPDATED",
        timestamp: new Date().toISOString(),
        changes: {
          status: { from: fromStatus, to: toStatus },
        },
      };

      try {
        await this.db.collection("m2do_tasks").doc(task.id).update({
          status: toStatus,
          history: [...(task.history || []), statusHistoryEntry],
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        this.firebaseError = `Status update failed: ${err.message}`;
      }
    },

    buildCreateHistory() {
      const detailsValue = this.form.details || "";
      return [
        {
          action: "CREATED",
          timestamp: new Date().toISOString(),
          changes: {
            date: { to: this.form.date },
            to: { to: this.form.to },
            subject: { to: this.form.subject },
            details: { to: detailsValue },
            status: { to: this.form.status },
          },
        },
      ];
    },

    buildUpdateHistoryEntry(original) {
      const fields = ["date", "to", "subject", "details", "status"];
      const changes = {};

      fields.forEach((field) => {
        if (original[field] !== this.form[field]) {
          changes[field] = { from: original[field], to: this.form[field] };
        }
      });

      if (Object.keys(changes).length === 0) {
        return null;
      }

      return {
        action: "UPDATED",
        timestamp: new Date().toISOString(),
        changes,
      };
    },

    async saveTask() {
      if (!this.db || !this.authUser) return;
      this.saving = true;

      try {
        if (this.editingTaskId) {
          const existing = this.tasks.find((task) => task.id === this.editingTaskId);
          if (!existing) throw new Error("Task not found.");

          const newHistoryEntry = this.buildUpdateHistoryEntry(existing);
          if (!newHistoryEntry) {
            this.closeModal();
            return;
          }

          const updatedHistory = [...(existing.history || []), newHistoryEntry];
          await this.db.collection("m2do_tasks").doc(this.editingTaskId).update({
            date: this.form.date,
            to: this.form.to,
            subject: this.form.subject,
            details: this.form.details || "",
            status: this.form.status,
            history: updatedHistory,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          await this.db.collection("m2do_tasks").add({
            date: this.form.date,
            to: this.form.to,
            subject: this.form.subject,
            details: this.form.details || "",
            status: this.form.status,
            history: this.buildCreateHistory(),
            createdByUid: this.authUser.uid,
            createdByAuthType: this.authUser.isAnonymous ? "anonymous" : "user",
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          });
        }

        this.closeModal();
      } catch (err) {
        this.firebaseError = `Save failed: ${err.message}`;
      } finally {
        this.saving = false;
      }
    },
  };
};
