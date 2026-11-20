
const express = require('express');
const router = express.Router();

const {
    createGroup,
    getGroups,
    getGroupById,
    updateGroup,
    replaceGroup,
    deleteGroup,
    addGroupMembers,
    syncGroupFormResponses,
    auditGroupMembers
} = require('../controllers/groupController');

router.post('/', createGroup);

router.get('/', getGroups);
router.get('/:id', getGroupById);
router.post('/:id/members', addGroupMembers);
router.post('/:id/sync-form-responses', syncGroupFormResponses);
router.post('/:id/audit', auditGroupMembers);

router.patch('/:id', updateGroup);
router.put('/:id', replaceGroup);

router.delete('/:id', deleteGroup);

module.exports = router;
