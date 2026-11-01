const asyncHandler = require("express-async-handler");
const Task = require("../models/Task");
const { moveToTrash } = require("./trashController");

const ASSIGN_ROLES = ["super_admin", "hr_manager", "department_head"];

// ponytail: sweeps on read instead of a cron job — fine at this volume, add a
// scheduled job if task counts get large enough to make per-request sweeps costly.
async function markOverdueTasks(companyId) {
  await Task.updateMany(
    {
      company: companyId,
      status: { $ne: "completed" },
      dueDate: { $lt: new Date() },
      late: false,
    },
    { $set: { late: true, lateMarkedAt: new Date() } },
  );
}

exports.createTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, priority, dueDate, department } =
    req.body;
  if (!title || !title.trim()) {
    res.status(400);
    throw new Error("Title is required");
  }
  if (!assignedTo) {
    res.status(400);
    throw new Error("assignedTo is required");
  }

  const task = await Task.create({
    company: req.user.company,
    title: title.trim(),
    description: description?.trim() || "",
    assignedTo,
    assignedBy: req.user._id,
    department: department || undefined,
    priority: priority || "medium",
    dueDate: dueDate || undefined,
    statusHistory: [{ status: "pending", changedBy: req.user._id }],
  });

  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("statusHistory.changedBy", "name email");

  res.status(201).json({ success: true, data: populated });
});

exports.updateTask = asyncHandler(async (req, res) => {
  const { title, description, assignedTo, priority, dueDate } = req.body;

  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }

  if (title !== undefined) {
    if (!title.trim()) {
      res.status(400);
      throw new Error("Title is required");
    }
    task.title = title.trim();
  }
  if (description !== undefined) task.description = description?.trim() || "";
  if (assignedTo !== undefined) task.assignedTo = assignedTo;
  if (priority !== undefined) task.priority = priority;
  if (dueDate !== undefined) {
    task.dueDate = dueDate || undefined;
    if (task.late && task.dueDate && task.dueDate.getTime() > Date.now()) {
      task.late = false;
      task.lateMarkedAt = undefined;
    }
  }

  await task.save();
  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("statusHistory.changedBy", "name email")
    .populate("comments.user", "name email");

  res.json({ success: true, data: populated });
});

exports.getTasks = asyncHandler(async (req, res) => {
  await markOverdueTasks(req.user.company);
  const filter = { company: req.user.company };
  if (!ASSIGN_ROLES.includes(req.user.role)) {
    filter.assignedTo = req.user._id;
  } else if (req.query.mine === "true") {
    filter.assignedTo = req.user._id;
  } else if (req.query.assignedByMe === "true") {
    filter.assignedBy = req.user._id;
  }
  if (req.query.status) filter.status = req.query.status;

  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("statusHistory.changedBy", "name email")
    .sort({ createdAt: -1 });

  res.json({ success: true, data: tasks });
});

exports.getTask = asyncHandler(async (req, res) => {
  await markOverdueTasks(req.user.company);
  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  })
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("statusHistory.changedBy", "name email")
    .populate("comments.user", "name email");

  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  if (
    !ASSIGN_ROLES.includes(req.user.role) &&
    String(task.assignedTo._id) !== String(req.user._id)
  ) {
    res.status(403);
    throw new Error("Access denied");
  }
  res.json({ success: true, data: task });
});

exports.updateTaskStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!["pending", "in_progress", "completed"].includes(status)) {
    res.status(400);
    throw new Error("Invalid status");
  }

  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  if (
    !ASSIGN_ROLES.includes(req.user.role) &&
    String(task.assignedTo) !== String(req.user._id)
  ) {
    res.status(403);
    throw new Error("Access denied");
  }

  task.status = status;
  task.statusHistory.push({ status, changedBy: req.user._id });
  await task.save();
  const populated = await Task.findById(task._id)
    .populate("assignedTo", "name email")
    .populate("assignedBy", "name email")
    .populate("statusHistory.changedBy", "name email");
  res.json({ success: true, data: populated });
});

exports.addComment = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    res.status(400);
    throw new Error("Message is required");
  }

  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  if (
    !ASSIGN_ROLES.includes(req.user.role) &&
    String(task.assignedTo) !== String(req.user._id)
  ) {
    res.status(403);
    throw new Error("Access denied");
  }

  task.comments.push({ user: req.user._id, message: message.trim() });
  await task.save();
  const populated = await Task.findById(task._id).populate(
    "comments.user",
    "name email",
  );
  res.json({ success: true, data: populated });
});

exports.deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!task) {
    res.status(404);
    throw new Error("Task not found");
  }
  await moveToTrash("Task", task, req);
  res.json({ success: true, message: "Task deleted" });
});
