const {rules, items, triggers, cache} = require('openhab');



class Alerts {
    constructor(group)
    {
        this.group = group;
        this.cache_key = 'alerts_' + group;

        this.description = fires => {
            let description = '';
            for (const reason in fires ) {
                const data = fires[reason];

                if ('message' in data) {
                    description += data.message + "\n";
                } else if ('item' in data) {
                    description += data.item.label + ' - ' + data.item.stateDescription +"\n";
                }
            }

            items.getItem(this.group).upsertMetadataValue('description', description);
        };

        this.dumpe = reason => {
            const item = items.getItem(reason);
            if (item) {
                //let pattern = item.rawItem.getStateDescription().pattern ? item.rawItem.getStateDescription().pattern : '%s';

                

                return {
                    name: item.name,
                    state: item.state,
                    label: item.label,
                    //stateDescription: item.rawState.toUnit().format(pattern)
                    stateDescription: item.state
                };
            } else {
                return null;
            }
        };

        this.pushEvent = e => {

            let events = items.getItem(this.group).getMetadataValue('events');
            events = events ? JSON.parse(events) : [];

            events.push(e);
            console.log('push: ' + events.length);
            items.getItem(this.group).upsertMetadataValue('events', JSON.stringify(events));
        };


        this.popEvent = () => {
            let events = items.getItem(this.group).getMetadataValue('events');
            events = events ? JSON.parse(events) : [];

            const e = events.pop();

            console.log('pop: ' + events.length);

            items.getItem(this.group).upsertMetadataValue('events', JSON.stringify(events));

            return e;
        };
    }

    fire(reason, message) {
        let fires = cache.get(this.cache_key, () => ({ }));
        
        const before = JSON.stringify(Object.keys(fires));

        let data = {
            reason: reason
        };
        if (reason) {
            const item = this.dumpe(reason);
            if (item) {
                data['item'] = item;
            }
        }
        if (message) {
            data['message'] = message
        }
        fires[((typeof reason) !== 'undefined') ? reason : 'default'] = data;
        const after = JSON.stringify(Object.keys(fires));

        this.description(fires);
        
        if (before != after) {
            this.pushEvent(data);
            cache.put(this.cache_key, fires);

            items.getItem(this.group).postUpdate('OPEN');
        }

        return this;
    }



    restore(reason) {
        let fires = cache.get(this.cache_key, () => ({ }));

        const before = JSON.stringify(Object.keys(fires));

        if ((typeof reason) === 'string') {
            delete fires[reason];
        } else {
            fires = {};
        }

        let data = {
            reason: reason
        };
        if (reason) {
            const item = this.dumpe(reason);
            if (item) {
                data['item'] = item;
            }
        }
        const after = JSON.stringify(Object.keys(fires));

        this.description(fires);

        if (before != after) {
            
            cache.put(this.cache_key, fires);

            if (after == '[]') {
                this.pushEvent(data);
                items.getItem(this.group).postUpdate('CLOSED');
            }
        }

        return this;
    }

    on(fireCallback, restoreCallback) {

        items.getItem(this.group).upsertMetadataValue('events', JSON.stringify([]));
        rules.JSRule({
            name: this.group + ' Fire',
            description: "[AUTO]",
            triggers: [triggers.ItemStateUpdateTrigger(this.group, 'OPEN')],
            execute: data => {
                const e = this.popEvent();
                if (e && (typeof fireCallback === 'function')) {
                    fireCallback(e);
                }

                console.log('FIRE!');
            }
        });

        rules.JSRule({
            name: this.group + ' Restore',
            description: "[AUTO]",
            triggers: [triggers.ItemStateUpdateTrigger(this.group, 'CLOSED')],
            execute: data => {
                const e = this.popEvent();
                if (e && (typeof restoreCallback === 'function')) {
                    restoreCallback(e);
                }
            }
        });
        
        return this;
    }
}

exports.type = (group) => {
    return new Alerts(group);
};
