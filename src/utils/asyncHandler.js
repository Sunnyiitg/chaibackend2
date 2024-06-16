// bss ek method bna kr export krdega
const asyncHandler = (requestHandler) => {
    return (req,res,next) => {
        Promise.resolve(requestHandler(req,res,next))
        .catch((err)=> next(err))
    }
} 

export {asyncHandler}

// accepting a function as argument
// const asyncHandler1 = (func) => async (req,res,next)=>{
//     try {
//         await func(req,res,next)
//     } catch (err) {
//         res.status(err.code || 500).json({
//             success: false,
//             message: error.message
//         })
//     }
// }