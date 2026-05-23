import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Button } from "./ui/button";

export function ScrollToBottom({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2"
        >
          <Button size="sm" variant="outline" onClick={onClick}>
            <ArrowDown className="h-4 w-4" />
            New messages
          </Button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
