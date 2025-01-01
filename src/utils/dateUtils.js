const moment = require('moment');

const defaultDatePatterns = [
  'YYYY-MM-DDTHH:mm:ssZ', //custom
  moment.ISO_8601, //mandatory
  //others
  'YYYY-MM-DD',
  'DD-MM-YYYY',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'YYYY/MM/DD',
];

class DateUtils {
  constructor(patterns = defaultDatePatterns) {
    this.patterns = patterns;
  }

  isDateLike(val) {
    return moment(val, this.patterns, true).isValid();
  }

  toMoment(val) {
    return moment(val);
  }

  compare(date1, date2) {
    const m1 = this.toMoment(date1);
    const m2 = this.toMoment(date2);
    return m1.diff(m2);
  }
}

module.exports = DateUtils;