import dotenv from 'dotenv';
dotenv.config({ quiet: true });
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

// 1. Schema bắt buộc theo tài liệu 
const userSchema = new mongoose.Schema({
    name: { type: String, required: [true, 'Tên không được để trống'], minlength: [2, 'Tên phải có ít nhất 2 ký tự'] },
    age: { type: Number, required: [true, 'Tuổi không được để trống'], min: [0, 'Tuổi phải >= 0'] },
    email: { type: String, required: [true, 'Email không được để trống'], match: [/^\S+@\S+\.\S+$/, 'Email không hợp lệ'] },
    address: { type: String }
});
const User = mongoose.model('User', userSchema);

// 2. GET với Phân trang và Tìm kiếm
app.get("/api/users", async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1;
        let limit = parseInt(req.query.limit) || 5;
        const search = req.query.search || "";

        if (page < 1) page = 1;
        if (limit < 1) limit = 5;
        if (limit > 50) limit = 50;

        const filter = search ? {
            $or: [
                { name: { $regex: search, $options: "i" } },
                { email: { $regex: search, $options: "i" } },
                { address: { $regex: search, $options: "i" } }
            ]
        } : {};

        const skip = (page - 1) * limit;
        const [users, total] = await Promise.all([
            User.find(filter).skip(skip).limit(limit),
            User.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(total / limit);

        res.json({ page, limit, total, totalPages, data: users });
    } catch (err) {
        res.status(500).json({ error: "Lỗi máy chủ: " + err.message });
    }
});

// 3. POST - Tạo user 
app.post('/api/users', async (req, res) => {
    try {
        const { email } = req.body; 
        const existingUser = await User.findOne({ email: email.trim() });
        if (existingUser) {
            return res.status(400).json({ error: "Email này đã tồn tại trong hệ thống!" });
        }

        const newUser = await User.create(req.body); 
        res.status(201).json({ message: "Tạo người dùng thành công", data: newUser });
    } catch (err) {
        res.status(400).json({ error: err.message }); 
    }
});

// 4. PUT - Cập nhật 
app.put("/api/users/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, age, email, address } = req.body;
        
        const updateData = {};
        if (name) updateData.name = name.trim();
        if (age !== undefined) updateData.age = parseInt(age);
        if (email) updateData.email = email.trim();
        if (address) updateData.address = address.trim();

        const updatedUser = await User.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true, runValidators: true }
        );

        if (!updatedUser) return res.status(404).json({ error: "Không tìm thấy người dùng" });
        res.json({ message: "Cập nhật thành công", data: updatedUser });
    } catch (err) {
        res.status(400).json({ error: err.message }); 
    }
});

// 5. DELETE
app.delete('/api/users/:id', async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ error: "Không tìm thấy" });
        res.json({ message: "Xóa người dùng thành công" });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Kết nối DB và chạy server
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch(err => console.error("MongoDB Error:", err));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});