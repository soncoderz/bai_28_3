let mongoose = require('mongoose');

let transactionSupportPromise;

async function isTransactionSupported() {
    if (!mongoose.connection || !mongoose.connection.db) {
        return false;
    }

    if (!transactionSupportPromise) {
        transactionSupportPromise = mongoose.connection.db.admin().command({ hello: 1 })
            .then(function (response) {
                return Boolean(response.setName || response.msg === 'isdbgrid');
            })
            .catch(function () {
                return false;
            });
    }

    return await transactionSupportPromise;
}

function getSaveOptions(session) {
    return session ? { session } : undefined;
}

async function executeWithOptionalTransaction(work) {
    if (!await isTransactionSupported()) {
        return await work(null);
    }

    let session = await mongoose.startSession();
    session.startTransaction();

    try {
        let result = await work(session);
        await session.commitTransaction();
        return result;
    } catch (error) {
        await session.abortTransaction().catch(function () { });
        throw error;
    } finally {
        await session.endSession();
    }
}

module.exports = {
    executeWithOptionalTransaction: executeWithOptionalTransaction,
    getSaveOptions: getSaveOptions,
    isTransactionSupported: isTransactionSupported
};
