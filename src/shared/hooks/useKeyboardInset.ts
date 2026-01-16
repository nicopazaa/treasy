import { useEffect, useState } from 'react';
import { Keyboard, Platform, type KeyboardEvent } from 'react-native';

type KeyboardInset = {
  keyboardHeight: number;
  isKeyboardVisible: boolean;
};

const getHeight = (event?: KeyboardEvent): number => {
  const h = event?.endCoordinates?.height ?? 0;
  return Number.isFinite(h) ? h : 0;
};

export const useKeyboardInset = (): KeyboardInset => {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const handleShow = (event: KeyboardEvent) => {
      setKeyboardHeight(getHeight(event));
      setIsKeyboardVisible(true);
    };

    const handleHide = () => {
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    };

    const subs = [
      Keyboard.addListener('keyboardWillShow', handleShow),
      Keyboard.addListener('keyboardWillHide', handleHide),
      Keyboard.addListener('keyboardDidShow', handleShow),
      Keyboard.addListener('keyboardDidHide', handleHide),
    ];

    return () => {
      for (const sub of subs) sub.remove();
    };
  }, []);

  return { keyboardHeight, isKeyboardVisible };
};

