import firebase, { database, auth } from '../firebase';
import pick from 'lodash/pick';
import { fetchImportedProfile } from '../lib/api';
import { SIGN_IN, SIGN_OUT, GOOGLE_OAUTH_PROVIDER, FACEBOOK_OAUTH_PROVIDER, FIRST_NAME_FIELD, LAST_NAME_FIELD } from '../constants';
import { setApplicationError, clearApplicationError } from './application';
import { loadRegistration } from './registration';
import { isMobile, log } from '../lib/utils';

const usersRef = database.ref('/users');

export const signInWithCredentials = (email, password) => {
  return (dispatch) => {
    log('signInWithCredentials: signing in');
    auth.signInWithEmailAndPassword(email, password).then(() => {
      log('signInWithCredentials: signed in');
      dispatch(clearApplicationError());
    }).catch(err => {
      dispatch(setApplicationError(`signIn error: (${err.code}) ${err.message}`, err.message));
    });
  }
}

const createOrUpdateUser = (user, profile) => {
  let userRef = usersRef.child(user.uid);
  return userRef.once("value").then(snapshot => {
    //local function to create or update the user record in firebase
    //based on input state
    const updateUser = (userData, newProfile, importedProfile) => {
      if (!userData) {
        userData = pick(user, ['email', 'uid']);
        userData.created_at = firebase.database.ServerValue.TIMESTAMP;
      }
      userData.profile = Object.assign({}, importedProfile, newProfile, userData.profile);
      userData.last_login = firebase.database.ServerValue.TIMESTAMP;
      userRef.set(userData);
    };
    //should we look in the imported profile
    let userData = snapshot.val();
    if (!userData || !userData.profile || Object.keys(userData.profile).length <= 2) {
      fetchImportedProfile(user.email).then((importedProfile) =>
        updateUser(userData, profile, importedProfile)
      )
      .catch((err) => {
        window.Rollbar.error("Error fetching imported profile for " + user.email, {error: err});
        //update the data without the imported profile
        updateUser(userData, profile);
      });
    } else {
      //dont query imported profile in this case
      updateUser(userData, profile);
    }
  });
};

export const signInWithOAuthProvider = (providerName) => {
  return (dispatch) => {
    log('signInWithOAuthProvider: show popup for ' + providerName);
    let provider;
    let profileFields;
    switch (providerName) {
      case GOOGLE_OAUTH_PROVIDER:
        provider = new firebase.auth.GoogleAuthProvider();
        profileFields = {
          [FIRST_NAME_FIELD]: 'given_name',
          [LAST_NAME_FIELD]: 'family_name'
        };
        break;
      case FACEBOOK_OAUTH_PROVIDER:
        provider = new firebase.auth.FacebookAuthProvider();
        profileFields = {
          [FIRST_NAME_FIELD]: 'first_name',
          [LAST_NAME_FIELD]: 'last_name'
        };
        break;
      default:
    }
    const authResult = isMobile() ? auth.signInWithRedirect(provider) : auth.signInWithPopup(provider);
    authResult.then((result) => {
      log('signInWithOAuthProvider: signed in', result);
      const user = result.user;
      const userInfo = result.additionalUserInfo;
      if (!!userInfo && userInfo.isNewUser) {
        window.Rollbar.info("New user account created with OAuth for " + user.email, {provider: userInfo.providerId});
        if (!!userInfo.profile &&
            userInfo.profile[profileFields[FIRST_NAME_FIELD]] &&
            userInfo.profile[profileFields[LAST_NAME_FIELD]]) {
          createOrUpdateUser(user, {
            first_name: userInfo.profile[profileFields[FIRST_NAME_FIELD]],
            last_name: userInfo.profile[profileFields[LAST_NAME_FIELD]]
          });
        }
      }
      dispatch(clearApplicationError());
    }).catch(err => {
      if (err.code !== 'auth/popup-closed-by-user') {
        dispatch(setApplicationError(`signIn error: (${err.code}) ${err.message}`, err.message));
      }
    });
  }
}

export const createAccount = (email, password, profile) => {
  return (dispatch) => {
    auth.createUserWithEmailAndPassword(email, password).then((user) => {
      createOrUpdateUser(user, profile);
      dispatch(clearApplicationError());
      window.Rollbar.info("New user account created for " + email);
    }).catch(err => {
      dispatch(setApplicationError(`signUp error: (${err.code}) ${err.message}`, err.message));
      window.Rollbar.error("Error creating new user account for " + email, {error: err});
    });
  }
}

export const signOut = () => {
  return (dispatch) => {
    auth.signOut();
    dispatch(clearApplicationError());
  }
}

export const signedIn = (user) => ({
  type: SIGN_IN,
  email: user.email,
  uid: user.uid
});

export const signedOut = () => ({
  type: SIGN_OUT
});

export const forgotPassword = (email) => {
  return (dispatch) => {
    log('forgotPassword: sending reset password email');
    auth.sendPasswordResetEmail(email).then(() => {
      log('forgotPassword: sent email');
      dispatch(clearApplicationError());
    }).catch(err => {
      let uiMessage;
      switch(err.code) {
        case 'auth/invalid-email':
          uiMessage = "Please enter a valid email address.";
          break;
        case 'auth/user-not-found':
          uiMessage = "There is no matching account with that email address."
          break;
        default:
          uiMessage = "There was an error trying to send the reset password email. " +
            "Please contact registration@menschwork.org for help";
            break;
      }
      dispatch(setApplicationError(`forgotPassword error: (${err.code}) ${err.message}`, uiMessage));
    });
  }
}

export const startListeningToAuthChanges = (store) => {
  return (dispatch) => {
    return auth.onAuthStateChanged(user => {
      if (user) {
        log("user has signed in", user);
        createOrUpdateUser(user).then(() => {
          dispatch(signedIn(user));
          const state = store.getState();
          dispatch(loadRegistration(state.application.currentEvent, state.auth.currentUser));
        })
        .catch(err => {
          dispatch(setApplicationError(err, "Unable to load your account data"));
          auth.signOut();
        });
      } else {
        dispatch(signedOut());
      }
    });
  };
};
