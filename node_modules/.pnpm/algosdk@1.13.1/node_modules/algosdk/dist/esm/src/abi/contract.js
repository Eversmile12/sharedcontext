import { ABIMethod } from './method';
export class ABIContract {
    constructor(params) {
        if (typeof params.name !== 'string' ||
            !Array.isArray(params.methods) ||
            (params.networks && typeof params.networks !== 'object')) {
            throw new Error('Invalid ABIContract parameters');
        }
        this.name = params.name;
        this.description = params.desc;
        this.networks = params.networks ? { ...params.networks } : {};
        this.methods = params.methods.map((method) => new ABIMethod(method));
    }
    toJSON() {
        return {
            name: this.name,
            desc: this.description,
            networks: this.networks,
            methods: this.methods.map((method) => method.toJSON()),
        };
    }
}
//# sourceMappingURL=contract.js.map