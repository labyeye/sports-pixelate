const asyncHandler = require("express-async-handler");
const Announcement = require("../models/Announcement");
const Employee = require("../models/Employee");
const User = require("../models/User");
const { moveToTrash } = require("./trashController");
const { validateMagicBytes } = require("../middleware/upload");
const { notifyUsers } = require("../services/inAppNotify");

const ADMIN_ROLES = ["super_admin", "hr_manager"];

// POST /announcements/poster (multipart "poster") -> { url } to pass as posterUrl when creating the announcement
exports.uploadPoster = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Choose a JPG, PNG or WEBP poster");
  }
  await validateMagicBytes(req.file.path); // deletes the file if the content is not a real image
  res.status(201).json({
    success: true,
    url: `/uploads/announcement-posters/${req.file.filename}`,
  });
});

// Everyone who should see the announcement: the whole academy, departments (staff) or given roles (e.g. parents).
async function audienceUserIds(a) {
  const base = { company: a.company, status: { $ne: "inactive" } };
  if (a.targetAudience === "role") {
    return (
      await User.find({ ...base, role: { $in: a.roles } }).select("_id")
    ).map((u) => u._id);
  }
  if (a.targetAudience === "department") {
    const emps = await Employee.find({
      company: a.company,
      department: { $in: a.departments },
      status: "active",
    }).select("user");
    return emps.map((e) => e.user).filter(Boolean);
  }
  return (await User.find(base).select("_id")).map((u) => u._id);
}

exports.createAnnouncement = asyncHandler(async (req, res) => {
  const {
    title,
    content,
    category,
    priority,
    pinned,
    expiryDate,
    targetAudience,
    departments,
    roles,
    acknowledgementRequired,
    posterUrl,
  } = req.body;

  if (!title || !content) {
    res.status(400);
    throw new Error("Title and content are required");
  }
  if (
    posterUrl &&
    !/^\/uploads\/announcement-posters\/[\w.-]+$/.test(posterUrl)
  ) {
    res.status(400);
    throw new Error("Invalid poster");
  }

  const announcement = await Announcement.create({
    company: req.user.company,
    posterUrl: posterUrl || undefined,
    title,
    content,
    postedBy: req.user._id,
    category: category || "general",
    priority: priority || "medium",
    pinned: !!pinned,
    expiryDate: expiryDate || null,
    targetAudience: targetAudience || "all",
    departments: targetAudience === "department" ? departments || [] : [],
    roles: targetAudience === "role" ? roles || [] : [],
    acknowledgementRequired: !!acknowledgementRequired,
  });

  const populated = await Announcement.findById(announcement._id).populate(
    "postedBy",
    "name email",
  );
  res.status(201).json({ success: true, data: populated });

  // In-app notice for everyone in the audience, after the response so it never blocks.
  audienceUserIds(announcement)
    .then((ids) =>
      notifyUsers(
        announcement.company,
        ids.filter((id) => String(id) !== String(req.user._id)),
        {
          type: "announcement",
          title: announcement.title,
          message: announcement.content.slice(0, 140),
        },
      ),
    )
    .catch(() => {});
});

exports.getAnnouncements = asyncHandler(async (req, res) => {
  const isAdmin = ADMIN_ROLES.includes(req.user.role);
  const filter = { company: req.user.company };
  if (!isAdmin) {
    filter.active = true;
    filter.$or = [{ expiryDate: null }, { expiryDate: { $gte: new Date() } }];
  }

  let query = Announcement.find(filter)
    .populate("postedBy", "name email")
    .populate("departments", "name")
    .sort({ pinned: -1, date: -1 });
  if (isAdmin) {
    query = query
      .populate("readBy", "name email")
      .populate("acknowledgedBy", "name email");
  }
  let announcements = await query;

  // Audience targeting for everyone except the owner/HR.
  if (!isAdmin) {
    const emp = req.user.role === "parent"
      ? null
      : await Employee.findOne({ user: req.user._id }).select("department");
    announcements = announcements.filter((a) => {
      if (a.targetAudience === "all") return true;
      if (a.targetAudience === "department") {
        return (
          !!emp &&
          a.departments.some((d) => String(d._id) === String(emp.department))
        );
      }
      if (a.targetAudience === "role") return a.roles.includes(req.user.role);
      return true;
    });
    // Non-admins don't need the full reader lists, only whether they have read/acknowledged it.
    announcements = announcements.map((a) => {
      const obj = a.toObject();
      const me = String(req.user._id);
      obj.read = (obj.readBy || []).some((id) => String(id) === me);
      obj.acknowledged = (obj.acknowledgedBy || []).some(
        (id) => String(id) === me,
      );
      delete obj.readBy;
      delete obj.acknowledgedBy;
      return obj;
    });
  }

  res.json({ success: true, data: announcements });
});

async function findOwn(req, res) {
  const announcement = await Announcement.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!announcement) {
    res.status(404);
    throw new Error("Announcement not found");
  }
  return announcement;
}

exports.markRead = asyncHandler(async (req, res) => {
  const announcement = await findOwn(req, res);
  await Announcement.updateOne(
    { _id: announcement._id },
    { $addToSet: { readBy: req.user._id } },
  );
  res.json({ success: true });
});

exports.acknowledgeAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await findOwn(req, res);
  await Announcement.updateOne(
    { _id: announcement._id },
    { $addToSet: { acknowledgedBy: req.user._id, readBy: req.user._id } },
  );
  res.json({ success: true });
});

exports.deleteAnnouncement = asyncHandler(async (req, res) => {
  const announcement = await findOwn(req, res);
  await moveToTrash("Announcement", announcement, req);
  res.json({ success: true, message: "Announcement deleted" });
});
