const {rules, items, triggers, cache} = require('openhab');
const historymanager = require('openhab-history');

class Alerts {
    constructor(contact, history)
    {
        this.contact = contact;
        this.history = history;

        try {
            rules.when().item(this.history).receivedCommand().then(event => {
                let payload = {};
                try {
                    if ((typeof items.getItem(this.history).state) === 'string') {
                        payload = JSON.parse(items.getItem(this.history).state);
    
                        if ((typeof payload.state) === 'string') {
                             items.getItem(payload.contact).postUpdate(payload.state);
                            
                        }
                    }
                } catch (e) {
                    
                }
            }).build(this.history,'', [], this.history);
        } catch (e) {
            
        }

        this.payload = function(payload) {
            //let before = items.getItem(this.history).history.latestState();
            let before = items.getItem(this.history).state;
    
            let after = JSON.stringify(payload);

            let description = '';
            if ('message' in payload) {
                description += payload.message;
            } else if ('item' in payload) {
                description += payload.item.label + ' - ' + payload.item.stateDescription;
            }

            if (after.localeCompare(before) !== 0) {
                
                items.getItem(this.history).sendCommand(after); // ignore undefined states
                //items.getItem(this.history).history.persist();
                items.getItem(this.contact).postUpdate(payload.state);
                items.getItem(this.contact).replaceMetadata('description', description);

            }
        }

        this.dumper = reason => {
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
    }

    get fired() {
        return items.getItem(this.contact).state == 'OPEN';
    }

    history() {
        return items.getItem(this.history).persistence;
    }

    fireItem(reason, debounce = 60) {
        let t = time.ZonedDateTime.now().minusSeconds(debounce);
        if (items.getItem(this.history).persistence.updatedSince(t)) { // bounce
            return this;
        }

        let payload = {
            state: 'OPEN'
        };
        if (item) {
            const d = this.dumper(item);
            if (d) {
                payload['item'] = d;
            }
        }

        this.payload(payload);

        return this;
    }

    fire(message, debounce = 60) {
        let t = time.ZonedDateTime.now().minusSeconds(debounce);
        if (items.getItem(this.history).persistence.updatedSince(t)) { // bounce
            return this;
        }

        let payload = {
            state: 'OPEN'
        };
        if (message) {
            payload['message'] = message
        }

        this.payload(payload);

        return this;
    }

    restore(message) {
        let payload = {
            state: 'CLOSED'
        };
        if (message) {
            payload['message'] = message;
        }

        this.payload(payload);

        return this;
    }

    restoreItem(item) {
        let payload = {
            state: 'CLOSED'
        };
        if (item) {
            const d = this.dumper(item);
            if (d) {
                payload['item'] = d;
            }
        }

        this.payload(payload);

        return this;
    }

    on(fireCallback, restoreCallback) {
        if (this.contact !== null) {
            
            rules.JSRule({
                name: `${this.contact}_events`,
                //id: `${this.contact}_events`,
                description: "[AUTO]",
                triggers: [triggers.ItemStateUpdateTrigger(this.history)],
                overwrite: true,
                ruleGroup: "alerts",
                execute: data => {
                    if ((typeof items.getItem(this.history).state) === 'string') {
                        const payload = JSON.parse(items.getItem(this.history).state);

                        try {
                            

                            if ((typeof payload.state) === 'string') {
                                if ((payload.state === 'OPEN') && (typeof fireCallback === 'function')) {
                                    fireCallback(this, payload);
                                } else if ((payload.state === 'CLOSED') && (typeof restoreCallback === 'function')) {
                                    restoreCallback(this, payload);
                                }
                            }
                            
                        } catch (e) {
                            //console.log(e);
                        }
                    }
                }
            });
        }
        
        return this;
    }
}

function contact(group) {
    const history_item_name = `${group}_backlog`;

    if (items.getItem(history_item_name, true) === null) {
        items.addItem({
            type: 'String',
            name: history_item_name,
            //label: `${this.contact.label} history`,
            //category: 'light',
            groups: [group, 'gPersist'],
            //tags: this.contact.tags.concat(["History"]),
            //metadata: {
            /*expire: '10m,command=1',
            stateDescription: {
                config: {
                pattern: '%d%%',
                options: '1=Red, 2=Green, 3=Blue'
                }
            }*/
            //}
        });

        
    }

    return new Alerts(group, history_item_name);
};

module.exports = new Proxy({contact}, {
get: function (target, prop) {
    return target[prop] || target.contact(prop);
}
});