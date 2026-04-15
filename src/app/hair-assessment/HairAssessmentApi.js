import axiosInstance from '@/lib/axiosInstance';

/**
 * Fetch all hair assessment questions and sections
 * @returns {Promise<Object>} API response data
 */
export const getAssessmentQuestions = async () => {
    try {
        const response = await axiosInstance.get('/sessions/questions');
        return response.data;
    } catch (error) {
        console.error("Error fetching assessment questions:", error);
        throw error;
    }
};

/**
 * Create a new assessment session
 * @returns {Promise<Object>} API response data
 */
export const createSession = async () => {
    try {
        const response = await axiosInstance.post('/sessions');
        return response.data;
    } catch (error) {
        console.error("Error creating assessment session:", error);
        throw error;
    }
};

/**
 * Save user answers progressively
 * @param {string} sessionId 
 * @param {Object} answersData - { questionId, value }
 * @returns {Promise<Object>}
 */
export const updateAnswers = async (sessionId, answersData) => {
    // Format according to Roadmap v1.2.0: {"answers": [{"questionId": "...", "value": "..."}]}
    const payload = {
        answers: Array.isArray(answersData) ? answersData : [answersData]
    };
    try {
        const response = await axiosInstance.patch(`/sessions/${sessionId}/answers`, payload);
        return response.data;
    } catch (error) {
        console.error("Error updating answers:", error);
        throw error;
    }
};

/**
 * Mark questionnaire as complete
 * @param {string} sessionId 
 * @returns {Promise<Object>}
 */
export const finalizeQuiz = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`/sessions/${sessionId}/questionnaire/complete`, {});
        return response.data;
    } catch (error) {
        console.error("Error finalizing quiz:", error);
        throw error;
    }
};

/**
 * Upload diagnostic image
 * @param {string} sessionId 
 * @param {string} photoId (Front, Crown, Side)
 * @param {File} file 
 * @returns {Promise<Object>}
 */
export const uploadImage = async (sessionId, photoId, file) => {
    const formData = new FormData();
    formData.append('image', file);
    try {
        const response = await axiosInstance.post(`/sessions/${sessionId}/images/${photoId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        return response.data;
    } catch (error) {
        console.error("Error uploading image:", error);
        throw error;
    }
};

/**
 * Trigger AI analysis (Photo scan or fallback)
 * @param {string} sessionId 
 * @param {boolean} skipPhotos 
 * @returns {Promise<Object>}
 */
export const triggerAnalysis = async (sessionId, skipPhotos = false) => {
    try {
        const response = await axiosInstance.post(`/sessions/${sessionId}/trigger-analysis`, {
            skipPhotos
        });
        return response.data;
    } catch (error) {
        console.error("Error triggering analysis:", error);
        throw error;
    }
};

/**
 * Check session status (Polling)
 * @param {string} sessionId 
 * @returns {Promise<Object>}
 */
export const checkSessionStatus = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`/sessions/status/${sessionId}`);
        return response.data;
    } catch (error) {
        console.error("Error checking status:", error);
        throw error;
    }
};

/**
 * Fetch Full Results (Final Step - requires OTP)
 * @param {string} sessionId 
 * @returns {Promise<Object>}
 */
export const fetchFullResult = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`/sessions/${sessionId}/result`);
        return response.data;
    } catch (error) {
        console.error("Error fetching full result:", error);
        throw error;
    }
};

/**
 * Create Lead (Compliance Gate)
 * @param {Object} leadData { name, email, phone, sessionId, ... }
 * @returns {Promise<Object>}
 */
export const createLead = async (leadData) => {
    try {
        const response = await axiosInstance.post('/sessions/capture-lead', leadData);
        return response.data;
    } catch (error) {
        console.error("Error capturing lead:", error);
        throw error;
    }
};

/**
 * Fetch Final Report PDF URL payload
 * @param {string} sessionId 
 * @returns {Promise<Object>}
 */
export const fetchReport = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`/sessions/${sessionId}/report`);
        return response.data;
    } catch (error) {
        console.error("Error fetching report:", error);
        throw error;
    }
};
/**
 * Verify OTP for session
 * @param {string} sessionId 
 * @param {string} otp 
 * @returns {Promise<Object>}
 */
export const verifyOtp = async (sessionId, otp) => {
    try {
        const response = await axiosInstance.post(`/sessions/${sessionId}/verify-otp`, { otp });
        return response.data;
    } catch (error) {
        console.error("Error verifying OTP:", error);
        throw error;
    }
};
/**
 * Resend OTP for session
 * @param {string} sessionId 
 * @returns {Promise<Object>}
 */
export const resendOtp = async (sessionId) => {
    try {
        const response = await axiosInstance.post(`/sessions/${sessionId}/resend-otp`, {});
        return response.data;
    } catch (error) {
        console.error("Error resending OTP:", error);
        throw error;
    }
};
/**
* Download Final Report PDF directly
* @param {string} sessionId
*/
export const downloadReport = async (sessionId) => {
    try {
        const response = await axiosInstance.get(`/sessions/${sessionId}/download`, {
            responseType: 'blob'
        });

        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `trichoscan-report-${sessionId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        return { success: true };
    } catch (error) {
        console.error("Error downloading report:", error);
        throw error;
    }
};
