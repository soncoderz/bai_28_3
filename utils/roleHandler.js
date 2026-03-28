let roleModel = require('../schemas/roles');

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
    getRoleByName: async function (name, session) {
        let query = roleModel.findOne({
            isDeleted: false,
            name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') }
        });
        if (session) {
            query = query.session(session);
        }
        return await query;
    },
    getOrCreateRoleByName: async function (name, session) {
        let role = await this.getRoleByName(name, session);
        if (role) {
            return role;
        }
        role = new roleModel({
            name: name,
            description: `Auto created role ${name}`
        });
        await role.save(session ? { session } : undefined);
        return role;
    }
}
