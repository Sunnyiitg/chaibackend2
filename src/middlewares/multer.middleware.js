import multer from "multer";
// we will be using diskStorage
// cb is call back
// cb 2nd argument is destination where files will be stored
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null,"./public/temp")
    },
    filename: function (req,file,cb) {
        cb(null,file.originalname)
    }
})

export const upload = multer({
    // storage: storage,
    storage,
})