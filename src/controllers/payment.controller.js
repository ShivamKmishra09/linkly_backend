import axios from 'axios'
import crypto from 'crypto'
import dotenv from 'dotenv';
dotenv.config();

let salt_key = '96434309-7796-489d-8924-ab56988a6076'
let merchant_id = 'PGTESTPAYUAT86'

export const newPayment = async (req, res) => {
    try {

        let merchantTransactionId = req.body.transactionId;

        const data = {
            userId: req.body.userId,
            merchantId: merchant_id,
            merchantTransactionId: merchantTransactionId,
            name: req.body.name,
            amount: req.body.amount * 100,
            redirectUrl: `${process.env.REACT_APP_BACKEND_URL}/status?id=${merchantTransactionId}&token=${req.body.token}&userId=${req.body.userId}&name=${req.body.name}`,
            redirectMode: "POST",
            mobileNumber: req.body.phone,
            paymentInstrument: {
                type: "PAY_PAGE"
            }
        }

        const payload = JSON.stringify(data)
        const payloadMain = Buffer.from(payload).toString('base64')
        const keyIndex = 1
        const string = payloadMain + '/pg/v1/pay' + salt_key;
        const sha256 = crypto.createHash('sha256').update(string).digest('hex');
        const checksum = sha256 + '###' + keyIndex;

        // const prod_URL = "https://api.phonepe.com/apis/hermes/pg/v1/pay"
        const prod_URL = "https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/pay"

        const options = {
            method: 'POST',
            url: prod_URL,
            headers: {
                accept: 'application/json',
                'Content-Type': 'application/json',
                'X-VERIFY': checksum
            },
            data: {
                request: payloadMain
            }
        }

        await axios(options).then(function (response) {
            return res.json(response.data)

        }).catch(function (error) {
            console.log(error)
        })

    } catch (error) {
        console.log(error)
    }
}

export const checkStatus = async (req, res) => {
    const merchantTransactionId = req.query.id
    const token2 = req.query.token
    const userId = req.query.userId
    const merchantId = merchant_id
    const subscriptionType = req.query.name

    const keyIndex = 1
    const string = `/pg/v1/status/${merchantId}/${merchantTransactionId}` + salt_key;
    const sha256 = crypto.createHash('sha256').update(string).digest('hex');
    const checksum = sha256 + '###' + keyIndex;

    const options = {
        method: 'GET',
        url: `https://api-preprod.phonepe.com/apis/pg-sandbox/pg/v1/status/${merchantId}/${merchantTransactionId}`,
        headers: {
            accept: 'application/json',
            'Content-Type': 'application/json',
            'X-VERIFY': checksum,
            'X-MERCHANT-ID': `${merchantId}`
        }
    }

    try {
        const response = await axios.request(options);
        if (response.data.success === true) {
            try {
                const patchResponse = await axios.patch(`${process.env.REACT_APP_BACKEND_URL}/loggedin/${userId}/subscription`, {
                    subscriptionType: subscriptionType
                }, {
                    headers: {
                        Authorization: `Bearer ${token2}`,
                    },
                });
                if (patchResponse.status === 200) {
                    res.redirect(`${process.env.REACT_APP_FRONTEND_URL}/loggedin/${userId}`);
                } else {
                    res.redirect(`${process.env.REACT_APP_FRONTEND_URL}/loggedin/${userId}`);
                }
            } catch (patchError) {
                console.log(patchError);
                res.redirect(`${process.env.REACT_APP_FRONTEND_URL}/loggedin/${userId}`);
            }
        } else {
            res.redirect(`${process.env.REACT_APP_FRONTEND_URL}/loggedin/${userId}`);
        }
    } catch (error) {
        console.log(error);
        res.redirect(`${process.env.REACT_APP_FRONTEND_URL}/loggedin/${userId}`);
    }
}