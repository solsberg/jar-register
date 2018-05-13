import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import Payment from '../components/Payment';
import { attemptCharge } from '../actions/payment';
import { recordExternalPayment, addToCart } from '../actions/registration';

const mapStateToProps = ({ registration, application }, { history, match }) => ({
  registration: registration.data,
  registrationStatus: registration.status,
  serverTimestamp: application.serverTimestamp,
  history,
  match
});

const mapDispatchToProps = (dispatch) => ({
  handleCharge(amount, token, description, event, user, onSuccess) {
    dispatch(attemptCharge(amount, token, description, event, user, onSuccess));
  },
  recordExternalPayment(event, user, externalType) {
    dispatch(recordExternalPayment(event, user, externalType));
  },
  addToCart(event, user, values) {
    dispatch(addToCart(event, user, values));
  }
});

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Payment));