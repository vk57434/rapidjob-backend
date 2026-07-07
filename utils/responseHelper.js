const sendSuccess = (res, data, message = 'Success', status = 200) => {
    res.status(status).json({
        success: true,
        message,
        data
    });
};

const sendError = (res, message = 'Internal Server Error', status = 500) => {
    res.status(status).json({
        success: false,
        error: message
    });
};

module.exports = {
    sendSuccess,
    sendError
};
