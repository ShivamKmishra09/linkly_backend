import mongoose from "mongoose";
import jwt from 'jsonwebtoken';

const userSchema = mongoose.Schema({
    username: {
        type: String,
        default: "Unkonwn",
    },
    email: {
        type: String,
        required: true,
        unique: true,
        default: "lub@gmail.com"
    },
    password: {
        type: String,
        required: true,
        default: "123456",
    },
    subscription: {
        type: String,
        enum: ['Free', 'Premium'],
        default: 'Free',
    },
    endDateOfSubscription: {
        type: Date,
        default: null
    },
    Links: {
        newLink: {
            type: [String],
            default: null
        },
        oldLink: {
            type: [String],
            default: null
        }
    },
    Viewer: {
        type:[Number],
        default: null
    }
});

export const User = mongoose.model('User', userSchema);

